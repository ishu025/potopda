const express = require('express');
const mongoose = require('mongoose');

const upload = require('../middleware/multer');
const { uploadBuffer, destroyAsset, downloadUrl } = require('../config/cloudinary');
const { compressPostImage } = require('../utils/imageCompress');
const { getCategory, isVideo } = require('../utils/category');
const { requireAuth } = require('../middleware/auth');
const { emitToUser, emitToAll } = require('../sockets');
const File = require('../models/File');
const Reaction = require('../models/Reaction');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

const VALID_CATEGORIES = ['images', 'files', 'all'];

function toObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function toCountMap(aggResult) {
  const map = {};
  aggResult.forEach((row) => {
    map[row._id.toString()] = row.count;
  });
  return map;
}

function formatFile(doc, extras) {
  return {
    id: doc._id,
    filename: doc.filename,
    size: doc.size,
    contentType: doc.contentType,
    category: doc.category,
    url: doc.url,
    uploadDate: doc.uploadDate,
    uploadedBy: doc.uploadedBy || null,
    ...extras,
  };
}

function formatKb(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

// ---------------------------------------------------------------------
// POST /api/upload — accepts one file under the "file" field.
// Images are compressed with Sharp before being sent to Cloudinary;
// everything else (PDFs, zips, etc.) goes up as-is. Videos are rejected.
// ---------------------------------------------------------------------
router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `That file is larger than the ${upload.maxRawUploadMb}MB upload limit. Please choose a smaller file and try again.`,
        });
      }
      console.error('Multer error:', err.message);
      return res.status(400).json({ message: 'Upload failed — please pick a single file and try again.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected. Choose a file before uploading.' });
    }

    if (isVideo(req.file.mimetype)) {
      return res.status(415).json({
        message: 'Video uploads are no longer supported here — please upload an image or a document instead.',
      });
    }

    const category = getCategory(req.file.mimetype);

    // Documents can't be auto-compressed, so they're held to the target
    // size directly. Images skip this check entirely — they're allowed in
    // at any reasonable size and Sharp compresses them down below.
    if (category === 'files' && req.file.size > upload.targetSizeKb * 1024) {
      return res.status(413).json({
        message: `Documents can't be compressed automatically, so they need to be under ${upload.targetSizeKb}KB. Please choose a smaller file or compress it yourself before uploading.`,
      });
    }

    try {
      let bufferToUpload = req.file.buffer;
      let contentType = req.file.mimetype || 'application/octet-stream';
      let resourceType = 'raw';
      let folder = 'potopda/files';

      if (category === 'images') {
        resourceType = 'image';
        folder = 'potopda/images';
        contentType = 'image/jpeg';
        try {
          bufferToUpload = await compressPostImage(req.file.buffer, upload.targetSizeKb * 1024);
        } catch (compressErr) {
          console.error('Sharp compression error:', compressErr.message);
          return res.status(422).json({
            message: 'That image could not be processed. Try a different file (JPEG, PNG, or WebP work best).',
          });
        }
      }

      let result;
      try {
        result = await uploadBuffer(bufferToUpload, {
          folder,
          resourceType,
          filename: req.file.originalname,
        });
      } catch (cloudErr) {
        console.error('Cloudinary upload error:', cloudErr.message);
        const configIssue = /not configured/i.test(cloudErr.message);
        return res.status(configIssue ? 500 : 502).json({
          message: configIssue
            ? 'Image storage is not configured on the server yet. Set the Cloudinary keys in .env and restart.'
            : 'Could not upload to cloud storage right now. Please try again in a moment.',
        });
      }

      let fileDoc;
      try {
        fileDoc = await File.create({
          filename: req.file.originalname,
          category,
          contentType,
          size: bufferToUpload.length,
          originalSize: req.file.size,
          url: result.secure_url,
          cloudinaryId: result.public_id,
          resourceType,
          uploadedBy: { id: req.user.id, username: req.user.username, name: req.user.name },
        });
      } catch (dbErr) {
        console.error('Could not save file metadata:', dbErr.message);
        await destroyAsset(result.public_id, resourceType);
        return res.status(500).json({ message: 'Upload was processed but saving its details failed. Please try again.' });
      }

      const publicFile = formatFile(fileDoc, { likes: 0, dislikes: 0, commentCount: 0, myReaction: null, canDelete: true });

      res.status(201).json({
        message:
          category === 'images'
            ? `Upload complete — compressed from ${formatKb(req.file.size)} to ${formatKb(bufferToUpload.length)}.`
            : 'Upload complete.',
        file: publicFile,
      });

      // Notify everyone else + broadcast the new file so every open tab can
      // drop it straight into its grid (and the bell badge) without anyone
      // needing to refresh or re-fetch the whole list.
      notifyOthersOfUpload(req, fileDoc).catch((err) => {
        console.error('Could not fan out upload notifications:', err.message);
      });

      emitToAll(req.app.get('io'), 'file:new', { category, file: publicFile });
    } catch (e) {
      console.error('Unexpected upload error:', e);
      res.status(500).json({ message: 'Something went wrong while uploading. Please try again.' });
    }
  });
});

// ---------------------------------------------------------------------
// Fans a "new_upload" notification out to every other user (the uploader
// never gets notified about their own upload) and pushes it live over the
// socket to anyone with that account open right now.
// ---------------------------------------------------------------------
async function notifyOthersOfUpload(req, fileDoc) {
  const others = await User.find({ _id: { $ne: req.user.id } }, '_id').lean();
  if (!others.length) return;

  const noun = fileDoc.category === 'images' ? 'photo' : 'file';
  const message = `${req.user.name} uploaded a new ${noun}: ${fileDoc.filename}`;
  const io = req.app.get('io');

  const docs = await Notification.insertMany(
    others.map((u) => ({
      recipient: u._id,
      type: 'new_upload',
      message,
      actor: { id: req.user.id, username: req.user.username, name: req.user.name },
      file: { id: fileDoc._id, filename: fileDoc.filename, category: fileDoc.category, url: fileDoc.url },
    }))
  );

  docs.forEach((doc) => {
    emitToUser(io, doc.recipient.toString(), 'notification:new', doc.toPublic());
  });
}

// ---------------------------------------------------------------------
// GET /api/files/:category — list metadata for images | files | all
// ---------------------------------------------------------------------
router.get('/files/:category', async (req, res) => {
  const { category } = req.params;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `Unknown category "${category}". Use images, files, or all.` });
  }

  try {
    const filter = category === 'all' ? {} : { category };
    const docs = await File.find(filter).sort({ uploadDate: -1 });
    const ids = docs.map((d) => d._id);

    const [likeAgg, dislikeAgg, commentAgg, myReactions] = await Promise.all([
      Reaction.aggregate([{ $match: { fileId: { $in: ids }, type: 'like' } }, { $group: { _id: '$fileId', count: { $sum: 1 } } }]),
      Reaction.aggregate([{ $match: { fileId: { $in: ids }, type: 'dislike' } }, { $group: { _id: '$fileId', count: { $sum: 1 } } }]),
      Comment.aggregate([{ $match: { fileId: { $in: ids } } }, { $group: { _id: '$fileId', count: { $sum: 1 } } }]),
      req.user ? Reaction.find({ fileId: { $in: ids }, userId: req.user.id }) : Promise.resolve([]),
    ]);

    const likeMap = toCountMap(likeAgg);
    const dislikeMap = toCountMap(dislikeAgg);
    const commentMap = toCountMap(commentAgg);

    const myReactionMap = {};
    myReactions.forEach((r) => {
      myReactionMap[r.fileId.toString()] = r.type;
    });

    const files = docs.map((doc) => {
      const owner = doc.uploadedBy;
      const isOwner = Boolean(req.user && owner && owner.id === req.user.id);
      const isAdmin = Boolean(req.user && req.user.role === 'admin');

      return formatFile(doc, {
        likes: likeMap[doc._id.toString()] || 0,
        dislikes: dislikeMap[doc._id.toString()] || 0,
        commentCount: commentMap[doc._id.toString()] || 0,
        myReaction: myReactionMap[doc._id.toString()] || null,
        canDelete: isOwner || isAdmin,
      });
    });

    res.json(files);
  } catch (e) {
    console.error('Could not load files:', e);
    res.status(500).json({ message: 'Could not load your files right now. Please refresh and try again.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/download/:id — redirect to a Cloudinary URL that forces a
// download with the original filename. Bytes are served straight from
// Cloudinary's CDN, not proxied through this server.
// ---------------------------------------------------------------------
router.get('/download/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That download link looks invalid.' });

  try {
    const doc = await File.findById(id);
    if (!doc) return res.status(404).json({ message: 'File not found — it may have been deleted.' });

    const url = downloadUrl(doc.cloudinaryId, doc.resourceType, doc.filename);
    res.redirect(url);
  } catch (e) {
    console.error('Could not build download link:', e);
    res.status(500).json({ message: 'Could not start the download. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// DELETE /api/files/:id — owner or admin only
// ---------------------------------------------------------------------
router.delete('/files/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That file link looks invalid.' });

  try {
    const doc = await File.findById(id);
    if (!doc) return res.status(404).json({ message: 'File not found — it may already be deleted.' });

    const owner = doc.uploadedBy;
    const isOwner = Boolean(owner && owner.id === req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete files you uploaded yourself.' });
    }

    await destroyAsset(doc.cloudinaryId, doc.resourceType);
    await Promise.all([doc.deleteOne(), Reaction.deleteMany({ fileId: id }), Comment.deleteMany({ fileId: id })]);

    res.json({ message: 'File deleted.' });
    emitToAll(req.app.get('io'), 'file:deleted', { id: doc._id, category: doc.category });
  } catch (e) {
    console.error('Could not delete file:', e);
    res.status(500).json({ message: 'Could not delete that file. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/files/:id/react — { type: 'like' | 'dislike' }, toggles on repeat
// ---------------------------------------------------------------------
router.post('/files/:id/react', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That file link looks invalid.' });

  const { type } = req.body || {};
  if (!['like', 'dislike'].includes(type)) {
    return res.status(400).json({ message: 'Reaction must be either "like" or "dislike".' });
  }

  try {
    const exists = await File.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: 'File not found — it may have been deleted.' });

    const existing = await Reaction.findOne({ fileId: id, userId: req.user.id });

    if (existing && existing.type === type) {
      await existing.deleteOne();
    } else if (existing) {
      existing.type = type;
      await existing.save();
    } else {
      await Reaction.create({ fileId: id, userId: req.user.id, type });
    }

    const [likes, dislikes, fresh] = await Promise.all([
      Reaction.countDocuments({ fileId: id, type: 'like' }),
      Reaction.countDocuments({ fileId: id, type: 'dislike' }),
      Reaction.findOne({ fileId: id, userId: req.user.id }),
    ]);

    res.json({ likes, dislikes, myReaction: fresh ? fresh.type : null });
  } catch (e) {
    console.error('Could not save reaction:', e);
    res.status(500).json({ message: 'Could not save your reaction. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/files/:id/comments
// ---------------------------------------------------------------------
router.get('/files/:id/comments', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That file link looks invalid.' });

  try {
    const comments = await Comment.find({ fileId: id }).sort({ createdAt: 1 });
    const list = comments.map((c) => ({
      id: c._id,
      text: c.text,
      username: c.username,
      name: c.name,
      createdAt: c.createdAt,
      canDelete: Boolean(req.user && (req.user.role === 'admin' || c.userId.toString() === req.user.id)),
    }));
    res.json(list);
  } catch (e) {
    console.error('Could not load comments:', e);
    res.status(500).json({ message: 'Could not load comments right now. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/files/:id/comments — { text }
// ---------------------------------------------------------------------
router.post('/files/:id/comments', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That file link looks invalid.' });

  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ message: 'Comment cannot be empty.' });
  if (text.length > 1000) return res.status(400).json({ message: 'Comment is too long (max 1000 characters).' });

  try {
    const exists = await File.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: 'File not found — it may have been deleted.' });

    const comment = await Comment.create({
      fileId: id,
      userId: req.user.id,
      username: req.user.username,
      name: req.user.name,
      text,
    });

    res.status(201).json({
      id: comment._id,
      text: comment.text,
      username: comment.username,
      name: comment.name,
      createdAt: comment.createdAt,
      canDelete: true,
    });
  } catch (e) {
    console.error('Could not post comment:', e);
    res.status(500).json({ message: 'Could not post your comment. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// DELETE /api/comments/:id — own comment or admin
// ---------------------------------------------------------------------
router.delete('/comments/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That comment link looks invalid.' });

  try {
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ message: 'Comment not found — it may already be deleted.' });

    const isOwner = comment.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own comments.' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted.' });
  } catch (e) {
    console.error('Could not delete comment:', e);
    res.status(500).json({ message: 'Could not delete that comment. Please try again.' });
  }
});

module.exports = router;
