const cloudinary = require('cloudinary').v2;

let configured = false;

/**
 * Configures the Cloudinary SDK from environment variables. Called once,
 * lazily, the first time it's needed — keeps server.js simple and gives
 * a clear error message if credentials are missing, instead of a vague
 * failure deep inside an upload stream.
 */
function configureCloudinary() {
  if (configured) return cloudinary;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and ' +
        'CLOUDINARY_API_SECRET in your .env (see .env.example).'
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
  return cloudinary;
}

/**
 * Uploads a buffer (already compressed by Sharp where relevant) to Cloudinary.
 * resource_type: 'image' for photos, 'raw' for everything else (pdf, zip, etc).
 */
function uploadBuffer(buffer, { folder, resourceType = 'image', filename } = {}) {
  const client = configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        // Keep the original filename recognizable in the Cloudinary dashboard
        // and available for forced-download URLs later.
        filename_override: filename,
        use_filename: Boolean(filename),
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

/**
 * Deletes a previously uploaded asset. Safe to call even if the asset is
 * already gone — Cloudinary just reports "not found" and we ignore it.
 */
async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId) return;
  const client = configureCloudinary();
  try {
    await client.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Cloudinary delete failed for ${publicId}:`, err.message);
  }
}

/**
 * Builds a URL that forces a browser download (Content-Disposition: attachment)
 * with the original filename, instead of Cloudinary's internal public_id.
 */
function downloadUrl(publicId, resourceType, originalFilename) {
  const client = configureCloudinary();
  return client.url(publicId, {
    resource_type: resourceType,
    secure: true,
    flags: `attachment:${encodeURIComponent(originalFilename || 'download')}`,
  });
}

module.exports = { configureCloudinary, uploadBuffer, destroyAsset, downloadUrl };
