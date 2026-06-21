import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { AuthModal } from './components/AuthModal';
import { GalleryPage } from './pages/GalleryPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { useAuth } from './context/AuthContext';
import { useAuthModal } from './context/AuthModalContext';
import { useTheme } from './hooks/useTheme';

// Pages that only make sense when logged in (Profile, Notifications).
// Logged-out visitors are sent back to the gallery with the login modal
// already open, rather than seeing an empty/broken page.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  if (loading) return null;
  if (!user) return <Navigate to="/images" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <TopBar theme={theme} onToggleTheme={toggleTheme} />

      <Routes>
        <Route path="/" element={<Navigate to="/images" replace />} />
        <Route path="/images" element={<GalleryPage category="images" />} />
        <Route path="/files" element={<GalleryPage category="files" />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/images" replace />} />
      </Routes>

      <AuthModal />
    </>
  );
}
