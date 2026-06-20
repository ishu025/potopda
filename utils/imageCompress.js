const sharp = require('sharp');

/**
 * Two compression presets:
 *  - Profile photos are small (shown as an avatar), so we compress harder
 *    (lower quality, smaller dimensions) — starting at 50% quality.
 *  - Post images are the main content people are viewing, so we keep more
 *    quality — starting at 75% quality — while still resizing oversized
 *    originals down to something reasonable.
 *
 * Both presets re-encode to JPEG, which compresses far better than PNG for
 * photos. `.rotate()` auto-applies EXIF orientation before stripping it, so
 * phone photos don't end up sideways. `.flatten()` fills transparency with
 * white before the JPEG conversion (JPEG has no alpha channel).
 *
 * If a target byte size is given and the first pass is still over budget
 * (rare — only happens on very busy/detailed images), quality is stepped
 * down further automatically until it fits or hits a floor. The caller
 * never needs to reject an image for being "too big" — compression handles
 * it silently, the same way it would for any normal phone photo.
 */

const PROFILE_PHOTO_QUALITY = 50;
const POST_IMAGE_QUALITY = 75;
const MIN_QUALITY = 20;
const QUALITY_STEP = 10;
const MAX_ATTEMPTS = 6;

async function compressImage(buffer, { resize, startQuality, targetBytes }) {
  let quality = startQuality;
  let output;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    output = await sharp(buffer)
      .rotate()
      .resize(resize)
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (!targetBytes || output.length <= targetBytes || quality <= MIN_QUALITY) break;
    quality -= QUALITY_STEP;
  }

  return output;
}

async function compressProfilePhoto(buffer, targetBytes) {
  return compressImage(buffer, {
    resize: { width: 500, height: 500, fit: 'cover', position: 'attention' },
    startQuality: PROFILE_PHOTO_QUALITY,
    targetBytes,
  });
}

async function compressPostImage(buffer, targetBytes) {
  return compressImage(buffer, {
    resize: { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true },
    startQuality: POST_IMAGE_QUALITY,
    targetBytes,
  });
}

module.exports = {
  compressProfilePhoto,
  compressPostImage,
  PROFILE_PHOTO_QUALITY,
  POST_IMAGE_QUALITY,
};
