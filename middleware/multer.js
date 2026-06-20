const multer = require('multer');

// Max upload size, in KB, accepted for any single file (profile photo, post
// image, or document). Default 500KB keeps individual uploads small before
// they're compressed further (for images) — this is what actually protects
// the MongoDB Atlas/free-tier limits this app runs under, since uploads now
// flow through Cloudinary rather than being written into MongoDB at all.
const maxSizeKb = parseInt(process.env.MAX_UPLOAD_SIZE_KB, 10) || 500;

// Files are held in memory only briefly — long enough to compress (images)
// and stream to Cloudinary — then discarded. Nothing touches local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeKb * 1024 },
});

module.exports = upload;
module.exports.maxSizeKb = maxSizeKb;
