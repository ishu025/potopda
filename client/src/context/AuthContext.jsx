import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (username, name, password) => {
    const data = await api.post('/api/auth/signup', { username, name, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logging out should always succeed client-side even if the network
      // request fails — there's nothing useful to retry here.
    }
    setUser(null);
  }, []);

  // Used after avatar upload, name edit, etc. — patches the cached user
  // instead of re-fetching /me, so the header updates instantly.
  const updateUser = useCallback((patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
