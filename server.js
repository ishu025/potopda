require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', fileRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`potopda is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start potopda:', err.message);
    process.exit(1);
  }
}

start();
