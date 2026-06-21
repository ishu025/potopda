import { createContext, useCallback, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const { user } = useAuth();
  const { showToast } = useToast();

  const openAuthModal = useCallback((m = 'login') => {
    setMode(m);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setIsOpen(false), []);

  // The single thing every "you must be logged in" action point calls:
  // returns true if already logged in, otherwise nudges with a toast and
  // opens the modal, mirroring the original app's requireLogin() guard.
  const requireLogin = useCallback(() => {
    if (user) return true;
    showToast('Please log in first.', true);
    openAuthModal('login');
    return false;
  }, [user, showToast, openAuthModal]);

  return (
    <AuthModalContext.Provider value={{ isOpen, mode, openAuthModal, closeAuthModal, requireLogin }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within an AuthModalProvider');
  return ctx;
}
