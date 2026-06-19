/**
 * Maps a MIME type to one of potopda's three sections.
 * Anything that isn't an image or a video falls into "files".
 */
function getCategory(mimetype) {
  if (typeof mimetype !== 'string') return 'files';
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  return 'files';
}

module.exports = { getCategory };
