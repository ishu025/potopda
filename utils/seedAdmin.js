const User = require('../models/User');
const { hashPassword } = require('./auth');

const ADMIN_USERNAME = 'ishu025dec2008';
const ADMIN_NAME = 'Ishu: Admin';
const ADMIN_PASSWORD = '1234567890ishu2008@dec';

async function seedAdmin() {
  const existing = await User.findOne({ username: ADMIN_USERNAME });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${ADMIN_USERNAME} to admin.`);
    }
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await User.create({
    username: ADMIN_USERNAME,
    name: ADMIN_NAME,
    passwordHash,
    role: 'admin',
  });

  console.log(`Admin account ready: ${ADMIN_USERNAME}`);
}

module.exports = seedAdmin;
