const { Server } = require('socket.io');
const cookie = require('cookie');
const { verifyToken } = require('../utils/auth');

/**
 * Every authenticated socket joins a room named `user:<id>` — that's how
 * a targeted notification ("new_upload" for everyone except the uploader)
 * reaches exactly the right open tabs/devices, no matter how many a person
 * has open. Anything meant for *everyone* (e.g. "a new file just landed in
 * Images") is sent with a plain io.emit(), which reaches every connected
 * socket regardless of room.
 */
function userRoom(userId) {
  return `user:${userId}`;
}

function readTokenFromHandshake(socket) {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  try {
    const parsed = cookie.parse(raw);
    return parsed.token || null;
  } catch (e) {
    return null;
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true,
    },
  });

  // Identify the socket's user (if any) from the same "token" cookie used
  // for regular HTTP auth. Sockets from logged-out visitors are still
  // allowed to connect — they just never join a user room, so they only
  // ever receive the public/global events (e.g. "a new file was added").
  io.use((socket, next) => {
    const token = readTokenFromHandshake(socket);
    socket.user = token ? verifyToken(token) : null;
    next();
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(userRoom(socket.user.id));
    }

    // Lets a logged-in tab pick up a freshly issued cookie (e.g. right
    // after login/signup/logout, before the page navigates) without
    // reconnecting — leaves whatever room it was in first, so a logout
    // doesn't leave a stale socket still listening in someone's room.
    socket.on('identify', () => {
      const token = readTokenFromHandshake(socket);
      const nextUser = token ? verifyToken(token) : null;

      if (socket.user) socket.leave(userRoom(socket.user.id));
      socket.user = nextUser;
      if (nextUser) socket.join(userRoom(nextUser.id));
    });
  });

  return io;
}

/** Emits to every open socket belonging to one specific user. */
function emitToUser(io, userId, event, payload) {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}

/** Emits to every connected socket, logged in or not. */
function emitToAll(io, event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = { initSocket, emitToUser, emitToAll };
