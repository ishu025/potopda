import { MediaCard } from './MediaCard';
import { FileRow } from './FileRow';
import { SkeletonGrid } from './Skeletons';

export function Grid({ category, files, loading, onOpenDetail, onReact, onDelete }) {
  const isList = category === 'files';

  if (loading && files.length === 0) {
    return <SkeletonGrid isList={isList} />;
  }

  if (!loading && files.length === 0) {
    return (
      <div className="empty-state">
        <p>Nothing here yet.</p>
        <p className="empty-sub">Drop a file above to add the first one.</p>
      </div>
    );
  }

  return (
    <div className={`grid${isList ? ' is-list' : ''}`} aria-live="polite">
      {files.map((file) =>
        isList ? (
          <FileRow key={file.id} file={file} onOpenDetail={onOpenDetail} onReact={onReact} onDelete={onDelete} />
        ) : (
          <MediaCard key={file.id} file={file} onOpenDetail={onOpenDetail} onReact={onReact} onDelete={onDelete} />
        )
      )}
    </div>
  );
}
