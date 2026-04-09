import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// ── CSRF Token Management ──
let csrfToken = localStorage.getItem('sumx_csrf_token') || '';

export function setCsrfToken(token) {
  csrfToken = token;
  localStorage.setItem('sumx_csrf_token', token);
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sumx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Attach CSRF token to state-changing requests
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Track whether a refresh is in progress to prevent concurrent refresh calls
let isRefreshing = false;
let refreshQueue = [];

function processQueue(error, token = null) {
  refreshQueue.forEach(p => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err.config;

    // If 401 and we have a refresh token, try to refresh
    if (err.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('sumx_refresh_token');
      if (refreshToken && !originalRequest.url?.includes('/auth/refresh') && !originalRequest.url?.includes('/auth/login')) {
        originalRequest._retry = true;

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          });
        }

        isRefreshing = true;
        try {
          const res = await axios.post(
            (import.meta.env.VITE_API_URL || '/api') + '/auth/refresh',
            { refreshToken }
          );
          const { token: newToken, refreshToken: newRefreshToken, csrfToken: newCsrf } = res.data;
          localStorage.setItem('sumx_token', newToken);
          localStorage.setItem('sumx_refresh_token', newRefreshToken);
          if (newCsrf) setCsrfToken(newCsrf);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          localStorage.removeItem('sumx_token');
          localStorage.removeItem('sumx_refresh_token');
          localStorage.removeItem('sumx_user');
          localStorage.removeItem('sumx_csrf_token');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      localStorage.removeItem('sumx_token');
      localStorage.removeItem('sumx_refresh_token');
      localStorage.removeItem('sumx_user');
      localStorage.removeItem('sumx_csrf_token');
      window.location.href = '/login';
    }

    // If 403 CSRF error, try to get a fresh token and retry once
    if (err.response?.status === 403 && !originalRequest._csrfRetry &&
        (err.response?.data?.error || '').toLowerCase().includes('csrf')) {
      originalRequest._csrfRetry = true;
      try {
        const csrfRes = await api.get('/auth/csrf-token');
        if (csrfRes.data?.csrfToken) {
          setCsrfToken(csrfRes.data.csrfToken);
          originalRequest.headers['X-CSRF-Token'] = csrfRes.data.csrfToken;
          return api(originalRequest);
        }
      } catch {}
    }

    // Capture API errors for monitoring (non-401s, non-cancellations)
    if (err.response?.status !== 401 && !axios.isCancel(err)) {
      const errorInfo = {
        type: 'api_error',
        url: err.config?.url,
        method: err.config?.method,
        status: err.response?.status,
        message: err.response?.data?.error || err.message,
      };
      if (window.__captureError) {
        window.__captureError(new Error(`API ${err.response?.status || 'network'}: ${err.config?.url}`), errorInfo);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
