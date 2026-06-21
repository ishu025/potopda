import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast } from '../context/ToastContext';

export function AuthModal() {
  const { isOpen, mode, closeAuthModal, openAuthModal } = useAuthModal();
  const { login, signup } = useAuth();
  const { showToast } = useToast();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [signupUsername, setSignupUsername] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupBusy, setSignupBusy] = useState(false);

  // Forms reset whenever the modal closes, so reopening it (e.g. after a
  // logout) never shows stale input or a leftover error.
  useEffect(() => {
    if (isOpen) return;
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setSignupUsername('');
    setSignupName('');
    setSignupPassword('');
    setSignupError('');
  }, [isOpen]);

  useEffect(() => {
    function onKeydown(e) {
      if (e.key === 'Escape' && isOpen) closeAuthModal();
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [isOpen, closeAuthModal]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const user = await login(loginUsername, loginPassword);
      closeAuthModal();
      showToast(`Welcome back, ${user.name}.`);
    } catch (err) {
      setLoginError(err.message || 'Could not log in.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setSignupError('');
    setSignupBusy(true);
    try {
      const user = await signup(signupUsername, signupName, signupPassword);
      closeAuthModal();
      showToast(`Welcome, ${user.name}.`);
    } catch (err) {
      setSignupError(err.message || 'Could not create account.');
    } finally {
      setSignupBusy(false);
    }
  }

  return (
    <div className="modal" hidden={!isOpen}>
      <div className="modal-backdrop" onClick={closeAuthModal} />
      <div className="auth-frame">
        <button className="modal-close" type="button" aria-label="Close" onClick={closeAuthModal}>
          &times;
        </button>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => openAuthModal('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'signup' ? ' is-active' : ''}`}
            onClick={() => openAuthModal('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" hidden={mode !== 'login'} onSubmit={handleLogin}>
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              required
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={loginBusy}>
            {loginBusy ? <span className="spinner" /> : 'Log in'}
          </button>
          <p className="auth-error" hidden={!loginError}>
            {loginError}
          </p>
        </form>

        <form className="auth-form" hidden={mode !== 'signup'} onSubmit={handleSignup}>
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              required
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
            />
          </label>
          <label>
            Name
            <input
              type="text"
              autoComplete="name"
              required
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={signupBusy}>
            {signupBusy ? <span className="spinner" /> : 'Create account'}
          </button>
          <p className="auth-error" hidden={!signupError}>
            {signupError}
          </p>
        </form>
      </div>
    </div>
  );
}
