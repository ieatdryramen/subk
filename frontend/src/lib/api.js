import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sumx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
          // Queue this request while refresh is in progress
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
          const { token: newToken, refreshToken: newRefreshToken } = res.data;
          localStorage.setItem('sumx_token', newToken);
          localStorage.setItem('sumx_refresh_token', newRefreshToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          // Refresh failed — force logout
          localStorage.removeItem('sumx_token');
          localStorage.removeItem('sumx_refresh_token');
          localStorage.removeItem('sumx_user');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      // No refresh token — force logout
      localStorage.removeItem('sumx_token');
      localStorage.removeItem('sumx_refresh_token');
      localStorage.removeItem('sumx_user');
      window.location.href = '/login';
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
