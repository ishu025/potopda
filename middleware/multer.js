const multer = require('multer');

// The size we actually want stored files to end up at. Used as the
// compression *target* for images (Sharp steps quality down until the
// result fits, or hits a quality floor), and as a hard cap for documents,
// which can't be auto-compressed.
const targetSizeKb = parseInt(process.env.MAX_UPLOAD_SIZE_KB, 10) || 500;

// The raw upload ceiling multer enforces before anything else runs. This
// has to be generous — a normal phone photo is 2-8MB before compression —
// so it only exists to stop genuinely oversized/abusive uploads, not
// regular photos. Compression (not this limit) is what keeps storage small.
const maxRawUploadMb = parseInt(process.env.MAX_RAW_UPLOAD_MB, 10) || 15;

// Files are held in memory only briefly — long enough to compress (images)
// and stream to Cloudinary — then discarded. Nothing touches local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxRawUploadMb * 1024 * 1024 },
});

module.exports = upload;
module.exports.targetSizeKb = targetSizeKb;
module.exports.maxRawUploadMb = maxRawUploadMb;
