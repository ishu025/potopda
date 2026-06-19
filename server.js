require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const seedAdmin = require('./utils/seedAdmin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

async function start() {
  try {
    await connectDB();
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`potopda is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start potopda:', err.message);
    process.exit(1);
  }
}

start();
