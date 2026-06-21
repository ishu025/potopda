import { Link, NavLink } from 'react-router-dom';
import { BrandMark, FilesTabIcon, ImagesTabIcon, MoonIcon, SunIcon } from './icons';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast } from '../context/ToastContext';

export function TopBar({ theme, onToggleTheme }) {
  const { user, logout } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { showToast } = useToast();

  async function handleLogout() {
    await logout();
    showToast('Logged out.');
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="brand-name">potopda</span>
      </div>

      <nav className="tabs" role="tablist" aria-label="Sections">
        <NavLink to="/images" className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`} role="tab">
          <ImagesTabIcon />
          <span>Images</span>
        </NavLink>
        <NavLink to="/files" className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`} role="tab">
          <FilesTabIcon />
          <span>Files</span>
        </NavLink>
      </nav>

      <div className="topbar-actions">
        {user && <NotificationBell />}

        <div className="user-area">
          {user ? (
            <div className="user-pill">
              <Link to="/profile" className="user-pill-link" title="Your profile">
                <Avatar user={user} size={22} />
                <span className="full-name">
                  {user.name}
                  {user.role === 'admin' && <span className="admin-tag"> ADMIN</span>}
                </span>
              </Link>
              <button type="button" className="logout-btn" title="Log out" onClick={handleLogout}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => openAuthModal('login')}>
                Log in
              </button>
              <button type="button" className="btn btn-primary" onClick={() => openAuthModal('signup')}>
                Sign up
              </button>
            </>
          )}
        </div>

        <button className="theme-toggle" type="button" aria-label="Switch theme" onClick={onToggleTheme}>
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>
    </header>
  );
}
