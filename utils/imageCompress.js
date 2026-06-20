const sharp = require('sharp');

/**
 * Two compression presets:
 *  - Profile photos are small (shown as an avatar), so we compress harder
 *    (lower quality, smaller dimensions) — 50% quality.
 *  - Post images are the main content people are viewing, so we keep more
 *    quality — 75% quality — while still resizing oversized originals down
 *    to something reasonable.
 *
 * Both presets re-encode to JPEG, which compresses far better than PNG for
 * photos and keeps output size predictable. `.rotate()` auto-applies EXIF
 * orientation before stripping it, so photos taken on phones don't end up
 * sideways. `.flatten()` fills transparency with white before the JPEG
 * conversion (JPEG has no alpha channel).
 */

const PROFILE_PHOTO_QUALITY = 50;
const POST_IMAGE_QUALITY = 75;

async function compressProfilePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 500, height: 500, fit: 'cover', position: 'attention' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: PROFILE_PHOTO_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function compressPostImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: POST_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer();
}

module.exports = {
  compressProfilePhoto,
  compressPostImage,
  PROFILE_PHOTO_QUALITY,
  POST_IMAGE_QUALITY,
};
