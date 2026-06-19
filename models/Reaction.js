const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
  },
  { timestamps: true }
);

reactionSchema.index({ fileId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Reaction', reactionSchema);
