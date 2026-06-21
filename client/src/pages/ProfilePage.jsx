import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { CameraIcon } from '../components/icons';
import { SkeletonLines } from '../components/Skeletons';
import { compressImageInBrowser } from '../utils/clientCompress';
import { formatBytes, formatDate } from '../utils/format';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const avatarInputRef = useRef(null);

  const [avatarBusy, setAvatarBusy] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    api
      .get('/api/auth/stats')
      .then(setStats)
      .catch((e) => setStatsError(e.message || 'Could not load your usage stats.'));
  }, []);

  async function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setAvatarBusy(true);
    let outgoing = file;
    if (file.type && file.type.startsWith('image/')) {
      try {
        outgoing = await compressImageInBrowser(file, { maxDimension: 500, quality: 0.5, square: true });
      } catch {
        // Send the original — the server compresses on arrival too.
      }
    }

    const formData = new FormData();
    formData.append('avatar', outgoing, file.name);

    try {
      const data = await api.postForm('/api/auth/avatar', formData);
      updateUser(data.user);
      showToast(data.message || 'Profile photo updated.');
    } catch (err) {
      showToast(err.message || 'Could not update your profile photo.', true);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarBusy(true);
    try {
      const data = await api.del('/api/auth/avatar');
      updateUser(data.user);
      showToast(data.message || 'Profile photo removed.');
    } catch (err) {
      showToast(err.message || 'Could not remove your profile photo.', true);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSaveName(e) {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    setNameBusy(true);
    try {
      const data = await api.put('/api/auth/profile', { name });
      updateUser(data.user);
      setNameSuccess('Name updated.');
      showToast('Name updated.');
    } catch (err) {
      setNameError(err.message || 'Could not update your name.');
    } finally {
      setNameBusy(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      const data = await api.put('/api/auth/password', { currentPassword, newPassword });
      setPasswordSuccess(data.message || 'Password changed.');
      showToast(data.message || 'Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Could not change your password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  if (!user) return null;

  return (
    <main className="content">
      <div className="gallery-head">
        <h1>Profile</h1>
      </div>

      <div className="profile-page">
        <div className="profile-card">
          <div className="profile-header">
            <button
              type="button"
              className="profile-avatar-btn"
              title="Change profile photo"
              disabled={avatarBusy}
              onClick={() => avatarInputRef.current.click()}
            >
              <Avatar user={user} size={84} />
              <span className="avatar-edit-badge">{avatarBusy ? <span className="spinner" /> : <CameraIcon />}</span>
            </button>
            <input
              type="file"
              accept="image/*"
              hidden
              ref={avatarInputRef}
              onChange={handleAvatarChange}
            />

            <div className="profile-identity">
              <span className="name">
                {user.name}
                {user.role === 'admin' && <span className="admin-tag"> ADMIN</span>}
              </span>
              <span className="username">@{user.username}</span>
              {user.createdAt && <span className="joined">Member since {formatDate(user.createdAt)}</span>}
              {user.avatarUrl && (
                <button type="button" className="profile-remove-photo" disabled={avatarBusy} onClick={handleRemoveAvatar}>
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h2>Your activity</h2>
          {statsError ? (
            <p className="form-error">{statsError}</p>
          ) : !stats ? (
            <SkeletonLines count={2} width={['40%', '70%']} />
          ) : (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="value">{stats.totalCount}</div>
                <div className="label">Uploaded posts</div>
              </div>
              <div className="stat-card">
                <div className="value">{formatBytes(stats.totalSize)}</div>
                <div className="label">Storage used</div>
              </div>
              <div className="stat-card">
                <div className="value">{stats.images.count}</div>
                <div className="label">Images ({formatBytes(stats.images.size)})</div>
              </div>
              <div className="stat-card">
                <div className="value">{stats.files.count}</div>
                <div className="label">Files ({formatBytes(stats.files.size)})</div>
              </div>
            </div>
          )}
        </div>

        <div className="profile-card">
          <h2>Edit name</h2>
          <form className="profile-form" onSubmit={handleSaveName}>
            <label>
              Display name
              <input type="text" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="form-row">
              <button type="submit" className="primary-btn" disabled={nameBusy} style={{ marginTop: 0 }}>
                {nameBusy ? <span className="spinner" /> : 'Save name'}
              </button>
              {nameError && <p className="form-error">{nameError}</p>}
              {!nameError && nameSuccess && <p className="form-success">{nameSuccess}</p>}
            </div>
          </form>
        </div>

        <div className="profile-card">
          <h2>Change password</h2>
          <form className="profile-form" onSubmit={handleChangePassword}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <div className="form-row">
              <button type="submit" className="primary-btn" disabled={passwordBusy} style={{ marginTop: 0 }}>
                {passwordBusy ? <span className="spinner" /> : 'Change password'}
              </button>
            </div>
            {passwordError && <p className="form-error">{passwordError}</p>}
            {!passwordError && passwordSuccess && <p className="form-success">{passwordSuccess}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}
