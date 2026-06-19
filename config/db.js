const mongoose = require('mongoose');

let bucket = null;

/**
 * Connects to MongoDB and initializes a GridFS bucket.
 * GridFS stores every uploaded file (image, video, or document) directly
 * inside MongoDB, split into chunks, alongside its metadata.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  const conn = await mongoose.connect(uri);

  bucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
    bucketName: 'uploads',
  });

  console.log(`MongoDB connected -> ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

/**
 * Returns the active GridFS bucket. Throws if called before connectDB().
 */
function getBucket() {
  if (!bucket) {
    throw new Error('GridFS bucket not ready yet — connectDB() must resolve first.');
  }
  return bucket;
}

module.exports = { connectDB, getBucket };
