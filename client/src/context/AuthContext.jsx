import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import { registerServiceWorkerAndSubscribe } from '../utils/push.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (phone, pin) => {
    const res = await api.post('/auth/login', { phone, pin });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    // Try to register push subscription after login
    try {
      const { data } = await api.get('/push/vapidPublicKey');
      const sub = await registerServiceWorkerAndSubscribe(data.publicKey);
      if (sub) await api.post('/push/subscribe', { subscription: sub.subscription });
    } catch (e) { /* non-fatal */ }
    return res.data.user;
  }, []);

  const adminLogin = useCallback(async (credentials) => {
    const res = await api.post('/auth/admin/login', credentials);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    // Try to register push subscription after admin login
    try {
      const { data } = await api.get('/push/vapidPublicKey');
      const sub = await registerServiceWorkerAndSubscribe(data.publicKey);
      if (sub) await api.post('/push/subscribe', { subscription: sub.subscription });
    } catch (e) { /* non-fatal */ }
    return res.data.user;
  }, []);

  const signup = useCallback(async (name, phone, pin) => {
    const res = await api.post('/auth/signup', { name, phone, pin });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    // Try to register push subscription after signup
    try {
      const { data } = await api.get('/push/vapidPublicKey');
      const sub = await registerServiceWorkerAndSubscribe(data.publicKey);
      if (sub) await api.post('/push/subscribe', { subscription: sub.subscription });
    } catch (e) { /* non-fatal */ }
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, adminLogin, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
