import { createContext, useContext, useEffect, useState } from 'react';
import { io as ioClient } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// One socket for the whole app's lifetime, created at module load — not
// per-render and not lazily inside the component. SocketProvider only
// ever mounts once at the app root, so there's no real "remount" case to
// design around, and keeping it at module scope sidesteps any ambiguity
// about when exactly a side-effecting connection gets opened.
//
// No URL given -> connects to the page's own origin. In dev, Vite proxies
// /socket.io to the Express server; in production they're already the
// same origin, since the client build is served by Express itself.
const socket = ioClient({ withCredentials: true });

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(socket.connected);
  const { user } = useAuth();

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Whenever the logged-in user changes (login, signup, logout) the
  // socket stays connected the whole time — it just re-reads the auth
  // cookie and joins/leaves the right room, so notifications start (or
  // stop) arriving immediately without a page reload.
  useEffect(() => {
    socket.emit('identify');
  }, [user?.id]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}
