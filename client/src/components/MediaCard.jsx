import { StatsRow } from './StatsRow';
import { CardActions } from './CardActions';

export function MediaCard({ file, onOpenDetail, onReact, onDelete }) {
  return (
    <div className="card">
      <img
        src={file.url}
        alt={file.filename}
        loading="lazy"
        className="card-media"
        onClick={() => onOpenDetail(file)}
      />

      <div className="card-foot">
        <span className="name" title={file.filename} style={{ cursor: 'pointer' }} onClick={() => onOpenDetail(file)}>
          {file.filename}
        </span>
        <CardActions file={file} onDelete={onDelete} />
      </div>

      <StatsRow file={file} className="card-stats" onReact={onReact} onOpenDetail={onOpenDetail} />
    </div>
  );
}
