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

  const userArea = document.getElementById('userArea');

  const authModal = document.getElementById('authModal');
  const authBackdrop = document.getElementById('authBackdrop');
  const authClose = document.getElementById('authClose');
  const authTabs = Array.from(document.querySelectorAll('.auth-tab'));
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginError = document.getElementById('loginError');
  const signupError = document.getElementById('signupError');

  const toast = document.getElementById('toast');

  const state = { category: 'images' };
  let currentUser = null;

  const ICONS = {
    download:
      '<svg viewBox="0 0 20 20" width="14" height="14"><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 14.5v1A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    trash:
      '<svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 6h12M8 6V4.5A1 1 0 0 1 9 3.5h2a1 1 0 0 1 1 1V6M6 6l.7 9.1A1.5 1.5 0 0 0 8.2 16.5h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ------------------------------- helpers -------------------------------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

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

  // -------------------------------- auth --------------------------------
  async function fetchMe() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      currentUser = data.user || null;
    } catch (e) {
      currentUser = null;
    }
    renderUserArea();
  }

  function renderUserArea() {
    userArea.innerHTML = '';

    if (currentUser) {
      const pill = document.createElement('div');
      pill.className = 'user-pill';

      const avatarBtn = document.createElement('button');
      avatarBtn.type = 'button';
      avatarBtn.className = 'avatar-btn';
      avatarBtn.title = 'Change profile photo';
      avatarBtn.appendChild(buildAvatarEl(currentUser));

      const avatarInput = document.createElement('input');
      avatarInput.type = 'file';
      avatarInput.accept = 'image/*';
      avatarInput.hidden = true;
      avatarInput.addEventListener('change', () => {
        if (avatarInput.files.length) uploadAvatar(avatarInput.files[0]);
        avatarInput.value = '';
      });

      avatarBtn.addEventListener('click', () => avatarInput.click());

      const adminTag = currentUser.role === 'admin' ? ' <span class="admin-tag">ADMIN</span>' : '';
      const nameEl = document.createElement('span');
      nameEl.className = 'full-name';
      nameEl.innerHTML = `${escapeHtml(currentUser.name)}${adminTag}`;

      const logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'logout-btn';
      logoutBtn.title = 'Log out';
      logoutBtn.textContent = '\u2715';
      logoutBtn.addEventListener('click', handleLogout);

      pill.appendChild(avatarBtn);
      pill.appendChild(avatarInput);
      pill.appendChild(nameEl);
      pill.appendChild(logoutBtn);
      userArea.appendChild(pill);
    } else {
      const loginBtn = document.createElement('button');
      loginBtn.type = 'button';
      loginBtn.className = 'btn';
      loginBtn.textContent = 'Log in';
      loginBtn.addEventListener('click', () => openAuthModal('login'));

      const signupBtn = document.createElement('button');
      signupBtn.type = 'button';
      signupBtn.className = 'btn btn-primary';
      signupBtn.textContent = 'Sign up';
      signupBtn.addEventListener('click', () => openAuthModal('signup'));

      userArea.appendChild(loginBtn);
      userArea.appendChild(signupBtn);
    }
  }

  function buildAvatarEl(user) {
    if (user.avatarUrl) {
      const img = document.createElement('img');
      img.src = user.avatarUrl;
      img.alt = '';
      img.className = 'avatar';
      return img;
    }
    const span = document.createElement('span');
    span.className = 'avatar';
    span.textContent = (user.name || '?').trim().charAt(0).toUpperCase();
    return span;
  }

  async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/auth/avatar', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || 'Could not update your profile photo.', true);
        return;
      }

      currentUser = data.user;
      renderUserArea();
      showToast(data.message || 'Profile photo updated.');
    } catch (err) {
      showToast('Could not update your profile photo \u2014 check your connection.', true);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    currentUser = null;
    renderUserArea();
    showToast('Logged out.');
    loadFiles();
  }

  function requireLogin() {
    if (currentUser) return true;
    showToast('Please log in first.', true);
    openAuthModal('login');
    return false;
  }

  function openAuthModal(mode) {
    setAuthMode(mode || 'login');
    authModal.hidden = false;
  }

  function closeAuthModal() {
    authModal.hidden = true;
    loginForm.reset();
    signupForm.reset();
    loginError.hidden = true;
    signupError.hidden = true;
  }

  function setAuthMode(mode) {
    authTabs.forEach((t) => t.classList.toggle('is-active', t.dataset.mode === mode));
    loginForm.hidden = mode !== 'login';
    signupForm.hidden = mode !== 'signup';
  }

  authTabs.forEach((t) => t.addEventListener('click', () => setAuthMode(t.dataset.mode)));
  authBackdrop.addEventListener('click', closeAuthModal);
  authClose.addEventListener('click', closeAuthModal);

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        loginError.textContent = data.message || 'Could not log in.';
        loginError.hidden = false;
        return;
      }

      currentUser = data.user;
      renderUserArea();
      closeAuthModal();
      showToast(`Welcome back, ${currentUser.name}.`);
      loadFiles();
    } catch (err) {
      loginError.textContent = 'Network error. Try again.';
      loginError.hidden = false;
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.hidden = true;

    const username = document.getElementById('signupUsername').value;
    const name = document.getElementById('signupName').value;
    const password = document.getElementById('signupPassword').value;

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        signupError.textContent = data.message || 'Could not create account.';
        signupError.hidden = false;
        return;
      }

      currentUser = data.user;
      renderUserArea();
      closeAuthModal();
      showToast(`Welcome, ${currentUser.name}.`);
      loadFiles();
    } catch (err) {
      signupError.textContent = 'Network error. Try again.';
      signupError.hidden = false;
    }
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

  // ------------------------------ stats row -------------------------------
  function buildStatsRow(file, className) {
    const row = document.createElement('div');
    row.className = className || 'card-stats';

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'stat-btn like' + (file.myReaction === 'like' ? ' is-active' : '');
    likeBtn.innerHTML = `\u{1F44D} <span>${file.likes}</span>`;
    likeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await handleReact(file, 'like');
      if (ok) loadFiles();
    });

    const dislikeBtn = document.createElement('button');
    dislikeBtn.type = 'button';
    dislikeBtn.className = 'stat-btn dislike' + (file.myReaction === 'dislike' ? ' is-active' : '');
    dislikeBtn.innerHTML = `\u{1F44E} <span>${file.dislikes}</span>`;
    dislikeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await handleReact(file, 'dislike');
      if (ok) loadFiles();
    });

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'stat-btn view-comments';
    commentBtn.innerHTML = `\u{1F4AC} <span>${file.commentCount}</span>`;
    commentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetail(file);
    });

    row.appendChild(likeBtn);
    row.appendChild(dislikeBtn);
    row.appendChild(commentBtn);
    return row;
  }

  async function handleReact(file, type) {
    if (!requireLogin()) return false;
    try {
      const res = await fetch(`/api/files/${file.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Could not react.', true);
        return false;
      }
      file.likes = data.likes;
      file.dislikes = data.dislikes;
      file.myReaction = data.myReaction;
      return true;
    } catch (e) {
      showToast('Could not react.', true);
      return false;
    }
  }

  // ------------------------------ builders -------------------------------
  function buildMediaCard(file) {
    const card = document.createElement('div');
    card.className = 'card';

    const media = document.createElement('img');
    media.src = file.url;
    media.alt = file.filename;
    media.loading = 'lazy';
    media.className = 'card-media';
    media.addEventListener('click', () => openDetail(file));
    card.appendChild(media);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.filename;
    name.title = file.filename;
    name.style.cursor = 'pointer';
    name.addEventListener('click', () => openDetail(file));
    foot.appendChild(name);
    foot.appendChild(buildActions(file));

    card.appendChild(foot);
    card.appendChild(buildStatsRow(file, 'card-stats'));
    return card;
  }

  function buildFileRow(file) {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return;
      openDetail(file);
    });

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
    info.appendChild(buildStatsRow(file, 'file-stats'));
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
    wrap.appendChild(downloadBtn);

    if (file.canDelete) {
      const deleteBtn = iconButton(ICONS.trash, 'Delete', () => handleDelete(file, false));
      deleteBtn.classList.add('danger');
      wrap.appendChild(deleteBtn);
    }

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

  async function handleDelete(file, fromDetail) {
    const ok = window.confirm(`Delete "${file.filename}"? This can't be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'Could not delete that file.', true);
        return;
      }
      showToast('File deleted.');
      if (fromDetail) closeModal();
      loadFiles();
    } catch (err) {
      console.error(err);
      showToast('Could not delete that file.', true);
    }
  }

  // ------------------------------- detail view -------------------------------
  function closeModal() {
    modal.hidden = true;
    modalBody.innerHTML = '';
  }

  modalBackdrop.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modal.hidden) closeModal();
      if (!authModal.hidden) closeAuthModal();
    }
  });

  async function openDetail(file) {
    modal.hidden = false;
    modalBody.innerHTML = '<p class="loading-state">Loading\u2026</p>';
    await renderDetail(file);
  }

  async function renderDetail(file) {
    let comments = [];
    try {
      const res = await fetch(`/api/files/${file.id}/comments`);
      comments = await res.json();
    } catch (e) {}

    modalBody.innerHTML = '';

    const detail = document.createElement('div');
    detail.className = 'detail';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'detail-media' + (file.category === 'files' ? ' is-file' : '');

    if (file.category === 'images') {
      const img = document.createElement('img');
      img.src = file.url;
      img.alt = file.filename;
      mediaWrap.appendChild(img);
    } else {
      mediaWrap.textContent = getExtension(file.filename);
    }
    detail.appendChild(mediaWrap);

    const body = document.createElement('div');
    body.className = 'detail-body';

    const head = document.createElement('div');
    head.className = 'detail-head';

    const nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = file.filename;
    head.appendChild(nameEl);

    if (file.canDelete) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'detail-delete';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => handleDelete(file, true));
      head.appendChild(delBtn);
    }
    body.appendChild(head);

    const byline = document.createElement('p');
    byline.className = 'detail-by';
    const ownerText = file.uploadedBy ? `Uploaded by ${file.uploadedBy.name} \u00B7 ` : '';
    byline.textContent = `${ownerText}${formatBytes(file.size)} \u00B7 ${formatDate(file.uploadDate)}`;
    body.appendChild(byline);

    const reactions = document.createElement('div');
    reactions.className = 'detail-reactions';

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'react-btn like' + (file.myReaction === 'like' ? ' is-active' : '');
    likeBtn.innerHTML = `\u{1F44D} <span>${file.likes}</span>`;
    likeBtn.addEventListener('click', async () => {
      const ok = await handleReact(file, 'like');
      if (ok) { renderDetail(file); loadFiles(); }
    });

    const dislikeBtn = document.createElement('button');
    dislikeBtn.type = 'button';
    dislikeBtn.className = 'react-btn dislike' + (file.myReaction === 'dislike' ? ' is-active' : '');
    dislikeBtn.innerHTML = `\u{1F44E} <span>${file.dislikes}</span>`;
    dislikeBtn.addEventListener('click', async () => {
      const ok = await handleReact(file, 'dislike');
      if (ok) { renderDetail(file); loadFiles(); }
    });

    reactions.appendChild(likeBtn);
    reactions.appendChild(dislikeBtn);
    body.appendChild(reactions);

    const commentsSection = document.createElement('div');
    commentsSection.className = 'detail-comments';

    const h3 = document.createElement('h3');
    h3.textContent = `Comments (${comments.length})`;
    commentsSection.appendChild(h3);

    const list = document.createElement('div');
    list.className = 'comments-list';

    if (!comments.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-comments';
      empty.textContent = 'No comments yet.';
      list.appendChild(empty);
    } else {
      comments.forEach((c) => list.appendChild(buildCommentItem(c, file)));
    }
    commentsSection.appendChild(list);

    if (currentUser) {
      const form = document.createElement('form');
      form.className = 'comment-form';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add a comment\u2026';
      input.maxLength = 1000;

      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.textContent = 'Post';

      form.appendChild(input);
      form.appendChild(submitBtn);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        try {
          const res = await fetch(`/api/files/${file.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const data = await res.json();
          if (!res.ok) {
            showToast(data.message || 'Could not post comment.', true);
            return;
          }
          file.commentCount += 1;
          renderDetail(file);
          loadFiles();
        } catch (err) {
          showToast('Could not post comment.', true);
        }
      });

      commentsSection.appendChild(form);
    } else {
      const hint = document.createElement('p');
      hint.className = 'login-hint';
      hint.textContent = 'Log in to comment.';
      commentsSection.appendChild(hint);
    }

    body.appendChild(commentsSection);
    detail.appendChild(body);
    modalBody.appendChild(detail);
  }

  function buildCommentItem(c, file) {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const meta = document.createElement('div');
    meta.className = 'comment-meta';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.name;

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = formatDate(c.createdAt);

    meta.appendChild(name);
    meta.appendChild(date);

    if (c.canDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'comment-del';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/comments/${c.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('failed');
          file.commentCount = Math.max(0, file.commentCount - 1);
          renderDetail(file);
          loadFiles();
        } catch (e) {
          showToast('Could not delete comment.', true);
        }
      });
      meta.appendChild(del);
    }

    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = c.text;

    item.appendChild(meta);
    item.appendChild(text);
    return item;
  }

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
    if (!requireLogin()) return;
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length) queueUploads(files);
  });

  browseBtn.addEventListener('click', () => {
    if (!requireLogin()) return;
    fileInput.click();
  });

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

        if (payload && payload.message) showToast(payload.message);

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

  // --------------------------------- init ---------------------------------
  (async function init() {
    await fetchMe();
    await loadFiles();
  })();
})();
