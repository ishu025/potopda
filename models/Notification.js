const mongoose = require('mongoose');

/**
 * One document per recipient (fan-out on write). Simpler to query ("my
 * unread notifications") than a single shared document with a read-state
 * map, and cheap to store since potopda is a small/self-hosted, low-user
 * deployment — the same trade-off this app already makes elsewhere
 * (lightweight metadata docs instead of cleverness).
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: ['new_upload'], required: true },
    message: { type: String, required: true },
    actor: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      name: { type: String, required: true },
    },
    file: {
      id: { type: mongoose.Schema.Types.ObjectId },
      filename: { type: String },
      category: { type: String, enum: ['images', 'files'] },
      url: { type: String },
    },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    type: this.type,
    message: this.message,
    actor: this.actor,
    file: this.file || null,
    read: this.read,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
