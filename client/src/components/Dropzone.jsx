import { useRef, useState } from 'react';
import { DropzoneIcon } from './icons';
import { useAuthModal } from '../context/AuthModalContext';

export function Dropzone({ onFiles }) {
  const [isDragover, setIsDragover] = useState(false);
  const inputRef = useRef(null);
  const { requireLogin } = useAuthModal();

  function handleDrop(e) {
    e.preventDefault();
    setIsDragover(false);
    if (!requireLogin()) return;
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length) onFiles(files);
  }

  return (
    <section
      className={`dropzone${isDragover ? ' is-dragover' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragover(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragover(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragover(false);
      }}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={inputRef}
        multiple
        hidden
        onChange={() => {
          if (inputRef.current.files.length) onFiles(inputRef.current.files);
          inputRef.current.value = '';
        }}
      />
      <div className="dropzone-inner">
        <span className="dropzone-icon">
          <DropzoneIcon />
        </span>
        <p className="dropzone-text">
          Drop files here, or{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              if (!requireLogin()) return;
              inputRef.current.click();
            }}
          >
            browse
          </button>
        </p>
        <p className="dropzone-hint">Images and documents — sorted automatically, stored on Cloudinary.</p>
      </div>
    </section>
  );
}
