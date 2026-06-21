import { useState } from 'react';

export function StatsRow({ file, className, onReact, onOpenDetail }) {
  const [pending, setPending] = useState(null); // 'like' | 'dislike' | null

  async function handleReact(type) {
    if (pending) return;
    setPending(type);
    try {
      await onReact(file, type);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={className || 'card-stats'}>
      <button
        type="button"
        className={`stat-btn like${file.myReaction === 'like' ? ' is-active' : ''}`}
        disabled={pending === 'like'}
        onClick={(e) => {
          e.stopPropagation();
          handleReact('like');
        }}
      >
        👍 <span>{file.likes}</span>
      </button>

      <button
        type="button"
        className={`stat-btn dislike${file.myReaction === 'dislike' ? ' is-active' : ''}`}
        disabled={pending === 'dislike'}
        onClick={(e) => {
          e.stopPropagation();
          handleReact('dislike');
        }}
      >
        👎 <span>{file.dislikes}</span>
      </button>

      <button
        type="button"
        className="stat-btn view-comments"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(file);
        }}
      >
        💬 <span>{file.commentCount}</span>
      </button>
    </div>
  );
}
