const express = require('express');
const mongoose = require('mongoose');

const { requireAuth } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function toObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------
// GET /api/notifications — most recent notifications for the logged-in
// user, newest first. Supports a simple "?before=<id>" cursor for
// loading older pages once the notification list grows.
// ---------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const filter = { recipient: req.user.id };

    if (req.query.before) {
      const cursor = toObjectId(req.query.before);
      if (cursor) filter._id = { $lt: cursor };
    }

    const docs = await Notification.find(filter).sort({ _id: -1 }).limit(limit);
    res.json({
      notifications: docs.map((d) => d.toPublic()),
      hasMore: docs.length === limit,
    });
  } catch (e) {
    console.error('Could not load notifications:', e);
    res.status(500).json({ message: 'Could not load your notifications right now. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/notifications/unread-count — just the badge number, so the
// bell icon can refresh cheaply on page load (live updates afterward
// arrive over the socket instead of polling this).
// ---------------------------------------------------------------------
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
    res.json({ count });
  } catch (e) {
    console.error('Could not count notifications:', e);
    res.status(500).json({ message: 'Could not load your notification count.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/notifications/:id/read — mark one notification as read.
// ---------------------------------------------------------------------
router.post('/:id/read', requireAuth, async (req, res) => {
  const id = toObjectId(req.params.id);
  if (!id) return res.status(400).json({ message: 'That notification looks invalid.' });

  try {
    const doc = await Notification.findOne({ _id: id, recipient: req.user.id });
    if (!doc) return res.status(404).json({ message: 'Notification not found.' });

    if (!doc.read) {
      doc.read = true;
      await doc.save();
    }

    const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
    res.json({ notification: doc.toPublic(), unreadCount: count });
  } catch (e) {
    console.error('Could not mark notification read:', e);
    res.status(500).json({ message: 'Could not update that notification. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/notifications/read-all — clear the badge in one call.
// ---------------------------------------------------------------------
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
    res.json({ unreadCount: 0 });
  } catch (e) {
    console.error('Could not mark all notifications read:', e);
    res.status(500).json({ message: 'Could not update your notifications. Please try again.' });
  }
});

module.exports = router;
