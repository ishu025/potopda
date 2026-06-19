const express = require('express');
const mongoose = require('mongoose');

const upload = require('../middleware/multer');
const { getBucket } = require('../config/db');
const { getCategory } = require('../utils/category');
const { requireAuth } = require('../middleware/auth');
const Reaction = require('../models/Reaction');
const Comment = require('../models/Comment');

const router = express.Router();

const VALID_CATEGORIES = ['images', 'videos', 'files', 'all'];

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

// ---------------------------------------------------------------------
// POST /api/upload — accepts one file under the "file" field
// ---------------------------------------------------------------------
router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        message: tooLarge ? 'File is larger than the allowed limit.' : 'Upload failed.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file was received.' });
    }

    try {
      const bucket = getBucket();
      const category = getCategory(req.file.mimetype);

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype || 'application/octet-stream',
        metadata: {
          category,
          uploadedBy: { id: req.user.id, username: req.user.username, name: req.user.name },
        },
      });

      uploadStream.on('error', (streamErr) => {
        console.error('GridFS upload stream error:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Could not save file to the database.' });
        }
      });

      uploadStream.on('finish', () => {
        res.status(201).json({
          message: 'Upload complete.',
          file: {
            id: uploadStream.id,
            filename: req.file.originalname,
            category,
            size: req.file.size,
            contentType: req.file.mimetype,
            uploadDate: new Date(),
          },
        });
      });

      uploadStream.end(req.file.buffer);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Server error during upload.' });
    }
  });
});

// ---------------------------------------------------------------------
// GET /api/files/:category — list metadata for images | videos | files | all
// ---------------------------------------------------------------------
router.get('/files/:category', async (req, res) => {
  const { category } = req.params;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Unknown category.' });
  }

  try {
    const bucket = getBucket();
    const filter = category === 'all' ? {} : { 'metadata.category': category };

    const docs = await bucket.find(filter, { sort: { uploadDate: -1 } }).toArray();
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
      const owner = doc.metadata && doc.metadata.uploadedBy;
      const isOwner = Boolean(req.user && owner && owner.id === req.user.id);
      const isAdmin = Boolean(req.user && req.user.role === 'admin');

      return {
        id: doc._id,
        filename: doc.filename,
        size: doc.length,
        contentType: doc.contentType,
        category: (doc.metadata && doc.metadata.category) || 'files',
        uploadDate: doc.uploadDate,
        uploadedBy: owner || null,
        likes: likeMap[doc._id.toString()] || 0,
        dislikes: dislikeMap[doc._id.toString()] || 0,
        commentCount: commentMap[doc._id.toString()] || 0,
        myReaction: myReactionMap[doc._id.toString()] || null,
        canDelete: isOwner || isAdmin,
      };
    });

    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not load files.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/stream/:id — inline playback/preview, range-aware (for video seeking)
// ---------------------------------------------------------------------
router.get('/stream/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const bucket = getBucket();
    const docs = await bucket.find({ _id: id }).toArray();
    if (!docs.length) return res.status(404).json({ message: 'File not found.' });

    const file = docs[0];
    const range = req.headers.range;

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : file.length - 1;
      const safeEnd = Math.min(end, file.length - 1);

      res.status(206);
      res.set('Content-Range', `bytes ${start}-${safeEnd}/${file.length}`);
      res.set('Content-Length', safeEnd - start + 1);

      bucket
        .openDownloadStream(id, { start, end: safeEnd + 1 })
        .on('error', () => res.end())
        .pipe(res);
    } else {
      res.set('Content-Length', file.length);
      bucket
        .openDownloadStream(id)
        .on('error', () => res.end())
        .pipe(res);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not stream file.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/download/:id — force a file download with its original name
// ---------------------------------------------------------------------
router.get('/download/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const bucket = getBucket();
    const docs = await bucket.find({ _id: id }).toArray();
    if (!docs.length) return res.status(404).json({ message: 'File not found.' });

    const file = docs[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);

    bucket
      .openDownloadStream(id)
      .on('error', () => res.end())
      .pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not download file.' });
  }
});

// ---------------------------------------------------------------------
// DELETE /api/files/:id — owner or admin only
// ---------------------------------------------------------------------
router.delete('/files/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const bucket = getBucket();
    const docs = await bucket.find({ _id: id }).toArray();
    if (!docs.length) return res.status(404).json({ message: 'File not found.' });

    const owner = docs[0].metadata && docs[0].metadata.uploadedBy;
    const isOwner = Boolean(owner && owner.id === req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own uploads.' });
    }

    await bucket.delete(id);
    await Promise.all([Reaction.deleteMany({ fileId: id }), Comment.deleteMany({ fileId: id })]);

    res.json({ message: 'File deleted.' });
  } catch (e) {
    console.error(e);
    res.status(404).json({ message: 'File not found or already deleted.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/files/:id/react — { type: 'like' | 'dislike' }, toggles on repeat
// ---------------------------------------------------------------------
router.post('/files/:id/react', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  const { type } = req.body || {};
  if (!['like', 'dislike'].includes(type)) {
    return res.status(400).json({ message: 'Reaction must be like or dislike.' });
  }

  try {
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
    console.error(e);
    res.status(500).json({ message: 'Could not save reaction.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/files/:id/comments
// ---------------------------------------------------------------------
router.get('/files/:id/comments', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

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
    console.error(e);
    res.status(500).json({ message: 'Could not load comments.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/files/:id/comments — { text }
// ---------------------------------------------------------------------
router.post('/files/:id/comments', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ message: 'Comment cannot be empty.' });
  if (text.length > 1000) return res.status(400).json({ message: 'Comment is too long.' });

  try {
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
    console.error(e);
    res.status(500).json({ message: 'Could not post comment.' });
  }
});

// ---------------------------------------------------------------------
// DELETE /api/comments/:id — own comment or admin
// ---------------------------------------------------------------------
router.delete('/comments/:id', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid comment id.' });

  try {
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ message: 'Comment not found.' });

    const isOwner = comment.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own comments.' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not delete comment.' });
  }
});

module.exports = router;
