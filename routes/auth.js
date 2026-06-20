const express = require('express');
const User = require('../models/User');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { uploadBuffer, destroyAsset } = require('../config/cloudinary');
const { compressProfilePhoto } = require('../utils/imageCompress');
const { isVideo } = require('../utils/category');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

router.post('/signup', async (req, res) => {
  try {
    const { username, name, password } = req.body || {};

    if (!username || !name || !password) {
      return res.status(400).json({ message: 'Username, name, and password are all required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({ message: 'Username can only use letters, numbers, dots and underscores (3-30 chars).' });
    }

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({ message: 'That username is already taken. Try a different one.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username: cleanUsername, name: String(name).trim(), passwordHash });

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTS);
    res.status(201).json({ user: user.toPublic() });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Could not create your account right now. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) return res.status(401).json({ message: 'Incorrect username or password.' });

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Incorrect username or password.' });

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user: user.toPublic() });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Could not log you in right now. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

// ---------------------------------------------------------------------
// POST /api/auth/avatar — upload/replace the logged-in user's profile
// photo. Compressed harder than post images (50% vs 75% quality) and
// cropped to a small square, since it's only ever shown as a tiny avatar.
// ---------------------------------------------------------------------
router.post('/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `That photo is larger than the ${upload.maxRawUploadMb}MB upload limit. Please choose a smaller image.`,
        });
      }
      console.error('Multer error (avatar):', err.message);
      return res.status(400).json({ message: 'Upload failed — please pick a single image and try again.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo was selected. Choose an image before uploading.' });
    }

    if (isVideo(req.file.mimetype) || !req.file.mimetype.startsWith('image/')) {
      return res.status(415).json({ message: 'Profile photo must be an image (JPEG, PNG, or WebP).' });
    }

    try {
      let compressed;
      try {
        compressed = await compressProfilePhoto(req.file.buffer, upload.targetSizeKb * 1024);
      } catch (compressErr) {
        console.error('Sharp compression error (avatar):', compressErr.message);
        return res.status(422).json({
          message: 'That image could not be processed. Try a different photo (JPEG, PNG, or WebP work best).',
        });
      }

      let result;
      try {
        result = await uploadBuffer(compressed, {
          folder: 'potopda/avatars',
          resourceType: 'image',
          filename: `avatar-${req.user.id}`,
        });
      } catch (cloudErr) {
        console.error('Cloudinary upload error (avatar):', cloudErr.message);
        const configIssue = /not configured/i.test(cloudErr.message);
        return res.status(configIssue ? 500 : 502).json({
          message: configIssue
            ? 'Image storage is not configured on the server yet. Set the Cloudinary keys in .env and restart.'
            : 'Could not upload your photo right now. Please try again in a moment.',
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        await destroyAsset(result.public_id, 'image');
        return res.status(404).json({ message: 'Your account could not be found. Please log in again.' });
      }

      const oldPublicId = user.avatarPublicId;
      user.avatarUrl = result.secure_url;
      user.avatarPublicId = result.public_id;
      await user.save();

      if (oldPublicId) await destroyAsset(oldPublicId, 'image');

      res.json({
        message: `Profile photo updated — compressed from ${Math.max(1, Math.round(req.file.size / 1024))}KB to ${Math.max(1, Math.round(compressed.length / 1024))}KB.`,
        user: user.toPublic(),
      });
    } catch (e) {
      console.error('Unexpected avatar upload error:', e);
      res.status(500).json({ message: 'Something went wrong while uploading your photo. Please try again.' });
    }
  });
});

// ---------------------------------------------------------------------
// DELETE /api/auth/avatar — remove the profile photo, back to initials.
// ---------------------------------------------------------------------
router.delete('/avatar', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Your account could not be found. Please log in again.' });

    if (user.avatarPublicId) await destroyAsset(user.avatarPublicId, 'image');

    user.avatarUrl = null;
    user.avatarPublicId = null;
    await user.save();

    res.json({ message: 'Profile photo removed.', user: user.toPublic() });
  } catch (e) {
    console.error('Could not remove avatar:', e);
    res.status(500).json({ message: 'Could not remove your profile photo. Please try again.' });
  }
});

module.exports = router;
