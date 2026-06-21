import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDate, getExtension } from '../utils/format';

export function DetailModal({ file, onClose, onReact, onDelete, onCommentCountChange }) {
  const { user } = useAuth();
  const { requireLogin } = useAuthModal();
  const { showToast } = useToast();

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [reactPending, setReactPending] = useState(null);

  useEffect(() => {
    if (!file) return;
    setCommentText('');
    setLoadingComments(true);
    api
      .get(`/api/files/${file.id}/comments`)
      .then((list) => setComments(list))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [file?.id]);

  useEffect(() => {
    function onKeydown(e) {
      if (e.key === 'Escape' && file) onClose();
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [file, onClose]);

  if (!file) return <div className="modal" hidden />;

  async function handleReact(type) {
    if (!requireLogin() || reactPending) return;
    setReactPending(type);
    try {
      await onReact(file, type);
    } finally {
      setReactPending(null);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || posting) return;

    setPosting(true);
    try {
      const comment = await api.post(`/api/files/${file.id}/comments`, { text });
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      onCommentCountChange(file.id, 1);
    } catch (err) {
      showToast(err.message || 'Could not post comment.', true);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId) {
    try {
      await api.del(`/api/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange(file.id, -1);
    } catch (err) {
      showToast(err.message || 'Could not delete comment.', true);
    }
  }

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-frame">
        <button className="modal-close" type="button" aria-label="Close preview" onClick={onClose}>
          &times;
        </button>
        <div className="modal-body">
          <div className="detail">
            <div className={`detail-media${file.category === 'files' ? ' is-file' : ''}`}>
              {file.category === 'images' ? (
                <img src={file.url} alt={file.filename} />
              ) : (
                getExtension(file.filename)
              )}
            </div>

            <div className="detail-body">
              <div className="detail-head">
                <span className="name">{file.filename}</span>
                {file.canDelete && (
                  <button
                    type="button"
                    className="detail-delete"
                    onClick={() => onDelete(file, true)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className="detail-by">
                {file.uploadedBy ? `Uploaded by ${file.uploadedBy.name} · ` : ''}
                {formatBytes(file.size)} · {formatDate(file.uploadDate)}
              </p>

              <div className="detail-reactions">
                <button
                  type="button"
                  className={`react-btn like${file.myReaction === 'like' ? ' is-active' : ''}`}
                  disabled={reactPending === 'like'}
                  onClick={() => handleReact('like')}
                >
                  👍 <span>{file.likes}</span>
                </button>
                <button
                  type="button"
                  className={`react-btn dislike${file.myReaction === 'dislike' ? ' is-active' : ''}`}
                  disabled={reactPending === 'dislike'}
                  onClick={() => handleReact('dislike')}
                >
                  👎 <span>{file.dislikes}</span>
                </button>
              </div>

              <div className="detail-comments">
                <h3>Comments ({comments.length})</h3>

                <div className="comments-list">
                  {loadingComments ? (
                    <p className="empty-comments">Loading…</p>
                  ) : comments.length === 0 ? (
                    <p className="empty-comments">No comments yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div className="comment-item" key={c.id}>
                        <div className="comment-meta">
                          <span className="name">{c.name}</span>
                          <span className="date">{formatDate(c.createdAt)}</span>
                          {c.canDelete && (
                            <button type="button" className="comment-del" onClick={() => handleDeleteComment(c.id)}>
                              Delete
                            </button>
                          )}
                        </div>
                        <p className="comment-text">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {user ? (
                  <form className="comment-form" onSubmit={handleAddComment}>
                    <input
                      type="text"
                      placeholder="Add a comment…"
                      maxLength={1000}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <button type="submit" disabled={posting}>
                      {posting ? <span className="spinner" /> : 'Post'}
                    </button>
                  </form>
                ) : (
                  <p className="login-hint">Log in to comment.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
