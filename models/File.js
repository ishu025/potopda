const mongoose = require('mongoose');

/**
 * Replaces GridFS's files/chunks collections. The actual bytes live on
 * Cloudinary now — this document is just metadata, typically well under
 * 1KB, so storing thousands of these costs almost nothing against the
 * MongoDB free-tier 512MB cap.
 */
const fileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    category: { type: String, enum: ['images', 'files'], required: true, index: true },
    contentType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true }, // bytes, after compression (for images)
    originalSize: { type: Number }, // bytes, before compression — handy for the "% saved" stat
    url: { type: String, required: true }, // Cloudinary secure_url, used directly by the frontend
    cloudinaryId: { type: String, required: true }, // public_id, needed to delete the asset later
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    uploadedBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      name: { type: String, required: true },
    },
  },
  { timestamps: { createdAt: 'uploadDate', updatedAt: false } }
);

module.exports = mongoose.model('File', fileSchema);
