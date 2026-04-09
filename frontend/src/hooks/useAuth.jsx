import { createContext, useContext, useState } from 'react';
import api, { setCsrfToken } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('sumx_user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });

    // Handle 2FA flow
    if (res.data.requires2fa) {
      return res.data; // Return { requires2fa: true, tempToken }
    }

    localStorage.setItem('sumx_token', res.data.token);
    localStorage.setItem('sumx_refresh_token', res.data.refreshToken);
    localStorage.setItem('sumx_user', JSON.stringify(res.data.user));
    if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
    setUser(res.data.user);
    return res.data;
  };

  const complete2fa = async (tempToken, code) => {
    const res = await api.post('/auth/2fa/validate', { tempToken, code });
    localStorage.setItem('sumx_token', res.data.token);
    localStorage.setItem('sumx_refresh_token', res.data.refreshToken);
    localStorage.setItem('sumx_user', JSON.stringify(res.data.user));
    if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, full_name, invite_code) => {
    const res = await api.post('/auth/register', { email, password, full_name, invite_code });
    localStorage.setItem('sumx_token', res.data.token);
    localStorage.setItem('sumx_refresh_token', res.data.refreshToken);
    localStorage.setItem('sumx_user', JSON.stringify(res.data.user));
    if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('sumx_refresh_token');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    localStorage.removeItem('sumx_token');
    localStorage.removeItem('sumx_refresh_token');
    localStorage.removeItem('sumx_user');
    localStorage.removeItem('sumx_csrf_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, complete2fa, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
