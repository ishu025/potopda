require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { initSocket } = require('./sockets');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const notificationRoutes = require('./routes/notifications');
const seedAdmin = require('./utils/seedAdmin');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// Socket.IO lives on the same HTTP server. `io` is stashed on the app so
// any route handler can reach it with req.app.get('io') without an extra
// import cycle between routes/ and sockets/.
const io = initSocket(httpServer);
app.set('io', io);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', fileRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Everything else is the React SPA (built into public/ by `npm run build`
// in client/). Routes like /profile or /notifications only exist on the
// client side — Express just needs to hand back index.html and let React
// Router take it from there, including on a hard refresh or a typed URL.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  try {
    await connectDB();
    await seedAdmin();
    httpServer.listen(PORT, () => {
      console.log(`potopda is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start potopda:', err.message);
    process.exit(1);
  }
}

start();
