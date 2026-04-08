import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sumx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sumx_token');
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
      // Use captureError if available (loaded from ErrorBoundary)
      if (window.__captureError) {
        window.__captureError(new Error(`API ${err.response?.status || 'network'}: ${err.config?.url}`), errorInfo);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
