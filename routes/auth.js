const express = require('express');
const User = require('../models/User');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');

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
      return res.status(409).json({ message: 'That username is already taken.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username: cleanUsername, name: String(name).trim(), passwordHash });

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTS);
    res.status(201).json({ user: { id: user._id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create account.' });
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
    res.json({ user: { id: user._id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not log in.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

module.exports = router;
