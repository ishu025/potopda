/**
 * Maps a MIME type to one of potopda's sections. Video support has been
 * removed (see isVideo below, used by the upload route to reject videos
 * with a clear message rather than silently accepting them).
 */
function getCategory(mimetype) {
  if (typeof mimetype !== 'string') return 'files';
  if (mimetype.startsWith('image/')) return 'images';
  return 'files';
}

function isVideo(mimetype) {
  return typeof mimetype === 'string' && mimetype.startsWith('video/');
}

module.exports = { getCategory, isVideo };
