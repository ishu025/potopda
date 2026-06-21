import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { SkeletonGrid } from '../components/Skeletons';
import { formatRelativeTime, getExtension } from '../utils/format';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, hasMore, loading, loadMore, markRead, markAllRead } = useNotifications();

  function handleItemClick(n) {
    if (!n.read) markRead(n.id);
    if (n.file) navigate(n.file.category === 'images' ? '/images' : '/files');
  }

  return (
    <main className="content">
      <div className="gallery-head">
        <h1>Notifications</h1>
        {unreadCount > 0 && <span className="count-pill">{unreadCount} unread</span>}
      </div>

      {notifications.length > 0 && (
        <p className="page-hint">
          <button type="button" className="notif-mark-all" disabled={unreadCount === 0} onClick={markAllRead}>
            Mark all as read
          </button>
        </p>
      )}

      {loading && notifications.length === 0 ? (
        <SkeletonGrid isList count={6} />
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <p>No notifications yet.</p>
          <p className="empty-sub">{"You'll hear about it the moment someone uploads something new."}</p>
        </div>
      ) : (
        <div className="notif-page">
          {notifications.map((n) => (
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
          ))}
        </div>
      )}

      {hasMore && (
        <button type="button" className="load-more-btn" disabled={loading} onClick={loadMore}>
          {loading ? <span className="spinner" /> : 'Load more'}
        </button>
      )}
    </main>
  );
}
