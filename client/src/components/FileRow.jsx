import { formatBytes, formatDate, getExtension } from '../utils/format';
import { StatsRow } from './StatsRow';
import { CardActions } from './CardActions';

export function FileRow({ file, onOpenDetail, onReact, onDelete }) {
  return (
    <div
      className="file-row"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        if (e.target.closest('.icon-btn')) return;
        onOpenDetail(file);
      }}
    >
      <div className="file-badge">{getExtension(file.filename)}</div>

      <div className="file-info">
        <div className="name" title={file.filename}>
          {file.filename}
        </div>
        <div className="meta">
          {formatBytes(file.size)} · {formatDate(file.uploadDate)}
        </div>
        <StatsRow file={file} className="file-stats" onReact={onReact} onOpenDetail={onOpenDetail} />
      </div>

      <CardActions file={file} onDelete={onDelete} />
    </div>
  );
}
