import { DownloadIcon, TrashIcon } from './icons';

export function CardActions({ file, onDelete }) {
  return (
    <div className="card-actions">
      <button
        type="button"
        className="icon-btn"
        aria-label="Download"
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = `/api/download/${file.id}`;
        }}
      >
        <DownloadIcon />
      </button>

      {file.canDelete && (
        <button
          type="button"
          className="icon-btn danger"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file);
          }}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
