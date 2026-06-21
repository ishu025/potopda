// Shown while a category's first page of files is loading, in place of
// the old plain "Loading…" text — gives an immediate sense of the grid's
// shape instead of a blank wait.
export function SkeletonGrid({ isList, count = 8 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (isList) {
    return (
      <div className="grid is-list" aria-hidden="true">
        {items.map((i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid" aria-hidden="true">
      {items.map((i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function SkeletonLines({ count = 3, width = '100%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton skeleton-line"
          style={{ width: typeof width === 'string' ? width : width[i] || '100%' }}
        />
      ))}
    </div>
  );
}
