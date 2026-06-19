(function () {
  'use strict';

  // ----------------------------- DOM refs -----------------------------
  const themeToggle = document.getElementById('themeToggle');
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const galleryTitle = document.getElementById('galleryTitle');
  const countPill = document.getElementById('countPill');
  const grid = document.getElementById('grid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const uploadQueue = document.getElementById('uploadQueue');

  const modal = document.getElementById('modal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalClose = document.getElementById('modalClose');
  const modalBody = document.getElementById('modalBody');

  const toast = document.getElementById('toast');

  const state = { category: 'images' };

  const ICONS = {
    download:
      '<svg viewBox="0 0 20 20" width="14" height="14"><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 14.5v1A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    trash:
      '<svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 6h12M8 6V4.5A1 1 0 0 1 9 3.5h2a1 1 0 0 1 1 1V6M6 6l.7 9.1A1.5 1.5 0 0 0 8.2 16.5h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ------------------------------- theme -------------------------------
  const THEME_KEY = 'potopda-theme';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  // -------------------------------- tabs --------------------------------
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;

      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      state.category = tab.dataset.category;
      galleryTitle.textContent = state.category.charAt(0).toUpperCase() + state.category.slice(1);
      loadFiles();
    });
  });

  // ----------------------------- data load ------------------------------
  async function loadFiles() {
    showLoading(true);
    try {
      const res = await fetch(`/api/files/${state.category}`);
      if (!res.ok) throw new Error('request failed');
      const files = await res.json();
      renderGrid(files);
    } catch (err) {
      console.error(err);
      showToast('Could not load files. Is the server running?', true);
      renderGrid([]);
    } finally {
      showLoading(false);
    }
  }

  function renderGrid(files) {
    grid.innerHTML = '';
    countPill.textContent = String(files.length);
    grid.classList.toggle('is-list', state.category === 'files');
    emptyState.hidden = files.length !== 0;

    files.forEach((file) => {
      const node = state.category === 'files' ? buildFileRow(file) : buildMediaCard(file);
      grid.appendChild(node);
    });
  }

  function showLoading(isLoading) {
    loadingState.hidden = !isLoading;
    if (isLoading) {
      grid.innerHTML = '';
      emptyState.hidden = true;
    }
  }

  // ------------------------------ builders -------------------------------
  function buildMediaCard(file) {
    const card = document.createElement('div');
    card.className = 'card';

    let media;
    if (file.category === 'images') {
      media = document.createElement('img');
      media.src = `/api/stream/${file.id}`;
      media.alt = file.filename;
      media.loading = 'lazy';
      media.className = 'card-media';
      media.addEventListener('click', () => openLightbox(file));
    } else {
      media = document.createElement('video');
      media.src = `/api/stream/${file.id}`;
      media.controls = true;
      media.preload = 'metadata';
      media.className = 'card-media';
    }
    card.appendChild(media);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.filename;
    name.title = file.filename;
    foot.appendChild(name);
    foot.appendChild(buildActions(file));

    card.appendChild(foot);
    return card;
  }

  function buildFileRow(file) {
    const row = document.createElement('div');
    row.className = 'file-row';

    const badge = document.createElement('div');
    badge.className = 'file-badge';
    badge.textContent = getExtension(file.filename);
    row.appendChild(badge);

    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = file.filename;
    name.title = file.filename;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${formatBytes(file.size)} \u00B7 ${formatDate(file.uploadDate)}`;

    info.appendChild(name);
    info.appendChild(meta);
    row.appendChild(info);
    row.appendChild(buildActions(file));

    return row;
  }

  function buildActions(file) {
    const wrap = document.createElement('div');
    wrap.className = 'card-actions';

    const downloadBtn = iconButton(ICONS.download, 'Download', () => {
      window.location.href = `/api/download/${file.id}`;
    });

    const deleteBtn = iconButton(ICONS.trash, 'Delete', () => handleDelete(file));
    deleteBtn.classList.add('danger');

    wrap.appendChild(downloadBtn);
    wrap.appendChild(deleteBtn);
    return wrap;
  }

  function iconButton(svgMarkup, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', label);
    btn.innerHTML = svgMarkup;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  async function handleDelete(file) {
    const ok = window.confirm(`Delete "${file.filename}"? This can't be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      showToast('File deleted.');
      loadFiles();
    } catch (err) {
      console.error(err);
      showToast('Could not delete that file.', true);
    }
  }

  // ------------------------------- lightbox -------------------------------
  function openLightbox(file) {
    modalBody.innerHTML = '';
    const img = document.createElement('img');
    img.src = `/api/stream/${file.id}`;
    img.alt = file.filename;
    modalBody.appendChild(img);
    modal.hidden = false;
  }

  function closeLightbox() {
    modal.hidden = true;
    modalBody.innerHTML = '';
  }

  modalBackdrop.addEventListener('click', closeLightbox);
  modalClose.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeLightbox();
  });

  // -------------------------------- uploads --------------------------------
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length) queueUploads(files);
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) queueUploads(fileInput.files);
    fileInput.value = '';
  });

  function queueUploads(fileList) {
    uploadQueue.hidden = false;
    Array.from(fileList).forEach(uploadFile);
  }

  function uploadFile(file) {
    const row = document.createElement('div');
    row.className = 'upload-row';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;

    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    bar.appendChild(fill);

    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = '0%';

    row.appendChild(name);
    row.appendChild(bar);
    row.appendChild(pct);
    uploadQueue.appendChild(row);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      fill.style.width = `${percent}%`;
      pct.textContent = `${percent}%`;
    });

    xhr.addEventListener('load', () => {
      const success = xhr.status >= 200 && xhr.status < 300;

      if (success) {
        row.classList.add('is-done');
        pct.textContent = 'Done';

        let payload = null;
        try { payload = JSON.parse(xhr.responseText); } catch (e) {}

        if (payload && payload.file && payload.file.category === state.category) {
          loadFiles();
        }

        setTimeout(() => {
          row.remove();
          if (!uploadQueue.children.length) uploadQueue.hidden = true;
        }, 1800);
      } else {
        row.classList.add('is-error');
        pct.textContent = 'Error';

        let message = 'Upload failed.';
        try { message = JSON.parse(xhr.responseText).message || message; } catch (e) {}
        showToast(message, true);
      }
    });

    xhr.addEventListener('error', () => {
      row.classList.add('is-error');
      pct.textContent = 'Error';
      showToast('Upload failed \u2014 check your connection.', true);
    });

    xhr.send(formData);
  }

  // -------------------------------- toast --------------------------------
  let toastTimer = null;

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { toast.hidden = true; }, 220);
    }, 2800);
  }

  // -------------------------------- helpers --------------------------------
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getExtension(filename) {
    const parts = String(filename).split('.');
    if (parts.length < 2) return 'FILE';
    return parts.pop().slice(0, 4).toUpperCase();
  }

  // --------------------------------- init ---------------------------------
  loadFiles();
})();
