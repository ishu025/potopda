import { useCallback, useState } from 'react';
import { Dropzone } from '../components/Dropzone';
import { UploadQueue } from '../components/UploadQueue';
import { Grid } from '../components/Grid';
import { DetailModal } from '../components/DetailModal';
import { useFiles } from '../hooks/useFiles';
import { useUploads } from '../hooks/useUploads';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';

const TITLES = { images: 'Images', files: 'Files' };

export function GalleryPage({ category }) {
  const { files, loading, patchFile, removeFile, prependFile } = useFiles(category);
  const { requireLogin } = useAuthModal();
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(null);

  // A new upload only belongs on this page if it actually landed in this
  // category — otherwise it's left for whichever page it does belong to
  // (which will pick it up the same way, either from its own upload
  // response or from the live socket broadcast).
  const handleUploaded = useCallback(
    (file) => {
      if (file.category === category) prependFile(file);
    },
    [category, prependFile]
  );

  const { queue, queueUploads } = useUploads({ onUploaded: handleUploaded, showToast });

  function handleFiles(fileList) {
    if (!requireLogin()) return;
    queueUploads(fileList);
  }

  async function handleReact(file, type) {
    if (!requireLogin()) return false;
    try {
      const data = await api.post(`/api/files/${file.id}/react`, { type });
      patchFile(file.id, { likes: data.likes, dislikes: data.dislikes, myReaction: data.myReaction });
      return true;
    } catch (err) {
      showToast(err.message || 'Could not react.', true);
      return false;
    }
  }

  async function handleDelete(file, fromDetail) {
    const ok = window.confirm(`Delete "${file.filename}"? This can't be undone.`);
    if (!ok) return;

    try {
      await api.del(`/api/files/${file.id}`);
      showToast('File deleted.');
      removeFile(file.id);
      if (fromDetail) setSelectedId(null);
    } catch (err) {
      showToast(err.message || 'Could not delete that file.', true);
    }
  }

  function handleCommentCountChange(fileId, delta) {
    const target = files.find((f) => f.id === fileId);
    if (target) patchFile(fileId, { commentCount: Math.max(0, target.commentCount + delta) });
  }

  const selectedFile = selectedId ? files.find((f) => f.id === selectedId) : null;

  return (
    <main className="content">
      <Dropzone onFiles={handleFiles} />
      <UploadQueue queue={queue} />

      <section className="gallery">
        <div className="gallery-head">
          <h1>{TITLES[category]}</h1>
          <span className="count-pill">{files.length}</span>
        </div>

        <Grid
          category={category}
          files={files}
          loading={loading}
          onOpenDetail={(file) => setSelectedId(file.id)}
          onReact={handleReact}
          onDelete={(file) => handleDelete(file, false)}
        />
      </section>

      {selectedFile && (
        <DetailModal
          file={selectedFile}
          onClose={() => setSelectedId(null)}
          onReact={handleReact}
          onDelete={handleDelete}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </main>
  );
}
