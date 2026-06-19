const express = require('express');
const mongoose = require('mongoose');

const upload = require('../middleware/multer');
const { getBucket } = require('../config/db');
const { getCategory } = require('../utils/category');

const router = express.Router();

const VALID_CATEGORIES = ['images', 'videos', 'files', 'all'];

function toObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------
// POST /api/upload — accepts one file under the "file" field
// ---------------------------------------------------------------------
router.post('/upload', (req, res) => {
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
        metadata: { category },
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

    const files = docs.map((doc) => ({
      id: doc._id,
      filename: doc.filename,
      size: doc.length,
      contentType: doc.contentType,
      category: (doc.metadata && doc.metadata.category) || 'files',
      uploadDate: doc.uploadDate,
    }));

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
// DELETE /api/files/:id — remove a file and its chunks
// ---------------------------------------------------------------------
router.delete('/files/:id', async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const bucket = getBucket();
    await bucket.delete(id);
    res.json({ message: 'File deleted.' });
  } catch (e) {
    console.error(e);
    res.status(404).json({ message: 'File not found or already deleted.' });
  }
});

module.exports = router;
