const mongoose = require('mongoose');

/**
 * Connects to MongoDB. Binary file data no longer lives here — GridFS has
 * been removed in favor of Cloudinary, so all this database now holds is
 * lightweight metadata (filenames, Cloudinary URLs, users, comments,
 * reactions). That's the fix for the 512MB free-tier ceiling: a few
 * thousand metadata documents are kilobytes, not gigabytes.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  const conn = await mongoose.connect(uri);

  console.log(`MongoDB connected -> ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

module.exports = { connectDB };
