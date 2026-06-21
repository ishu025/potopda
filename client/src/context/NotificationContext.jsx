import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadedOnceRef = useRef(false);

  const reset = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setHasMore(false);
    loadedOnceRef.current = false;
  }, []);

  // First load (and the only automatic load) happens once a user is
  // known — everything after that is either an explicit loadMore() call
  // from the Notifications page, or a live push over the socket.
  useEffect(() => {
    if (!user) {
      reset();
      return;
    }
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;

    (async () => {
      setLoading(true);
      try {
        const [list, count] = await Promise.all([
          api.get('/api/notifications'),
          api.get('/api/notifications/unread-count'),
        ]);
        setNotifications(list.notifications);
        setHasMore(list.hasMore);
        setUnreadCount(count.count);
      } catch {
        // Silent — the bell just stays at its previous/zero state, and
        // the Notifications page itself surfaces a retry if it's ever
        // empty because of this.
      } finally {
        setLoading(false);
      }
    })();
  }, [user, reset]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !notifications.length) return;
    setLoading(true);
    try {
      const before = notifications[notifications.length - 1].id;
      const list = await api.get(`/api/notifications?before=${before}`);
      setNotifications((prev) => [...prev, ...list.notifications]);
      setHasMore(list.hasMore);
    } catch {
      // No-op — the Load more button just stays clickable to retry.
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, notifications]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await api.post(`/api/notifications/${id}/read`);
      setUnreadCount(res.unreadCount);
    } catch {
      // The optimistic update already happened — a failed mark-as-read
      // just means the badge count might be one off until next sync.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.post('/api/notifications/read-all');
    } catch {
      // Optimistic update stands either way.
    }
  }, []);

  // The live half: a new upload anywhere in the app arrives here
  // instantly and gets prepended — no polling, no refetching the list.
  useEffect(() => {
    if (!socket) return;
    const onNew = (notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, hasMore, loading, loadMore, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
