const STATUS_LABEL = {
  queued: '…',
  compressing: 'Compressing…',
  uploading: null, // shows the live percent instead
  done: 'Done',
  error: 'Error',
};

export function UploadQueue({ queue }) {
  if (!queue.length) return null;

  return (
    <div className="upload-queue">
      {queue.map((item) => {
        const label = STATUS_LABEL[item.status] ?? `${item.progress}%`;
        return (
          <div key={item.id} className={`upload-row${item.status === 'done' ? ' is-done' : ''}${item.status === 'error' ? ' is-error' : ''}`}>
            <span className="name">{item.name}</span>
            <span className="bar">
              <span className="bar-fill" style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }} />
            </span>
            <span className="pct">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
