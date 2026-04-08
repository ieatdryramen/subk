import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('sumx_user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('sumx_token', res.data.token);
    localStorage.setItem('sumx_refresh_token', res.data.refreshToken);
    localStorage.setItem('sumx_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, full_name, invite_code) => {
    const res = await api.post("/auth/register", { email, password, full_name, invite_code });
    localStorage.setItem('sumx_token', res.data.token);
    localStorage.setItem('sumx_refresh_token', res.data.refreshToken);
    localStorage.setItem('sumx_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('sumx_refresh_token');
    // Invalidate refresh token server-side
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    localStorage.removeItem('sumx_token');
    localStorage.removeItem('sumx_refresh_token');
    localStorage.removeItem('sumx_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
