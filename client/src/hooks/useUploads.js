import { useCallback, useState } from 'react';
import { compressImageInBrowser } from '../utils/clientCompress';

let uploadIdCounter = 0;

/**
 * Manages the upload queue UI (progress bars) and does the actual upload
 * via XHR (fetch still doesn't have a universal upload-progress event).
 * `onUploaded(file)` fires once per successful upload with the file
 * record the server returned — callers decide what "matches the current
 * view" means, this hook just reports what happened.
 */
export function useUploads({ onUploaded, showToast } = {}) {
  const [queue, setQueue] = useState([]);

  const updateItem = useCallback((id, patch) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const uploadFile = useCallback(
    (file) => {
      const id = `up-${(uploadIdCounter += 1)}`;
      setQueue((prev) => [...prev, { id, name: file.name, progress: 0, status: 'queued' }]);

      (async () => {
        let outgoing = file;

        if (file.type && file.type.startsWith('image/')) {
          updateItem(id, { status: 'compressing' });
          try {
            outgoing = await compressImageInBrowser(file, { maxDimension: 1600, quality: 0.75, square: false });
          } catch {
            // Couldn't compress in-browser — send the original, the
            // server compresses on arrival too.
          }
        }

        updateItem(id, { status: 'uploading', progress: 0 });

        const formData = new FormData();
        formData.append('file', outgoing, file.name);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', (e) => {
          if (!e.lengthComputable) return;
          updateItem(id, { progress: Math.round((e.loaded / e.total) * 100) });
        });

        xhr.addEventListener('load', () => {
          const success = xhr.status >= 200 && xhr.status < 300;
          let payload = null;
          try {
            payload = JSON.parse(xhr.responseText);
          } catch {
            payload = null;
          }

          if (success) {
            updateItem(id, { status: 'done', progress: 100 });
            if (payload && payload.message) showToast?.(payload.message);
            if (payload && payload.file) onUploaded?.(payload.file);
            setTimeout(() => removeItem(id), 1800);
          } else {
            updateItem(id, { status: 'error' });
            showToast?.((payload && payload.message) || 'Upload failed.', true);
          }
        });

        xhr.addEventListener('error', () => {
          updateItem(id, { status: 'error' });
          showToast?.('Upload failed — check your connection.', true);
        });

        xhr.send(formData);
      })();
    },
    [updateItem, removeItem, onUploaded, showToast]
  );

  const queueUploads = useCallback(
    (fileList) => {
      Array.from(fileList).forEach(uploadFile);
    },
    [uploadFile]
  );

  return { queue, queueUploads };
}
