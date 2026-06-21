import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellIcon } from './icons';
import { useNotifications } from '../context/NotificationContext';
import { formatRelativeTime, getExtension } from '../utils/format';

const PREVIEW_COUNT = 6;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open]);

  function handleItemClick(n) {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.file) navigate(n.file.category === 'images' ? '/images' : '/files');
  }

  const preview = notifications.slice(0, PREVIEW_COUNT);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`bell-btn${unreadCount > 0 ? ' has-unread' : ''}`}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <h2>Notifications</h2>
            <button type="button" className="notif-mark-all" disabled={unreadCount === 0} onClick={markAllRead}>
              Mark all as read
            </button>
          </div>

          <div className="notif-list">
            {preview.length === 0 ? (
              <p className="notif-empty">{"You're all caught up."}</p>
            ) : (
              preview.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={`notif-item${n.read ? ' is-read' : ' is-unread'}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className="notif-dot" />
                  {n.file && n.file.category === 'images' ? (
                    <img className="notif-thumb" src={n.file.url} alt="" />
                  ) : (
                    <span className="notif-thumb is-file">{n.file ? getExtension(n.file.filename) : ''}</span>
                  )}
                  <span className="notif-body">
                    <p className="notif-message">{n.message}</p>
                    <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="notif-panel-foot">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
