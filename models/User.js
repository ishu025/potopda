const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },
  },
  { timestamps: true }
);

// Shape returned to the frontend — never includes passwordHash.
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    role: this.role,
    avatarUrl: this.avatarUrl || null,
  };
};

module.exports = mongoose.model('User', userSchema);
