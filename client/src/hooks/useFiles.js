import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useSocket } from '../context/SocketContext';

/**
 * Owns the file list for one category ("images" | "files"). The list is
 * fetched once per category switch — after that, every change (a reaction
 * click, a new upload, a delete, someone else's upload arriving over the
 * socket) patches this same array in place. Nothing here ever re-fetches
 * the whole list just to reflect one small change.
 */
export function useFiles(category) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket } = useSocket();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/files/${category}`);
      setFiles(data);
    } catch (e) {
      setError(e.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    reload();
  }, [reload]);

  const patchFile = useCallback((id, patch) => {
    setFiles((prev) => prev.map((f) => (String(f.id) === String(id) ? { ...f, ...patch } : f)));
  }, []);

  const removeFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => String(f.id) !== String(id)));
  }, []);

  const prependFile = useCallback((file) => {
    setFiles((prev) => {
      if (prev.some((f) => String(f.id) === String(file.id))) return prev;
      return [file, ...prev];
    });
  }, []);

  // Live updates: someone (possibly this same tab, via its own upload
  // response) added or removed a file in this category — patch the
  // section in place instead of asking the server for the whole list
  // again.
  useEffect(() => {
    if (!socket) return;

    const onNew = (payload) => {
      if (payload.category === category) prependFile(payload.file);
    };
    const onDeleted = (payload) => {
      if (payload.category === category) removeFile(payload.id);
    };

    socket.on('file:new', onNew);
    socket.on('file:deleted', onDeleted);
    return () => {
      socket.off('file:new', onNew);
      socket.off('file:deleted', onDeleted);
    };
  }, [socket, category, prependFile, removeFile]);

  return { files, loading, error, reload, patchFile, removeFile, prependFile };
}
