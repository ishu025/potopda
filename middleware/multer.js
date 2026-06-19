const multer = require('multer');

const maxSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 200;

// Files are held in memory only briefly, then streamed straight into
// MongoDB via GridFS — nothing is written to local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});

module.exports = upload;
