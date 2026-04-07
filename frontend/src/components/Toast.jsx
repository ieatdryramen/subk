import { createContext, useContext, useState, useCallback } from 'react';

// Toast context
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Toast type configurations
const TOAST_CONFIG = {
  success: {
    icon: '✓',
    color: 'var(--success)',
    bgColor: 'var(--success-bg)',
  },
  error: {
    icon: '✕',
    color: 'var(--danger)',
    bgColor: 'var(--danger-bg)',
  },
  warning: {
    icon: '⚠',
    color: 'var(--warning)',
    bgColor: 'var(--warning-bg)',
  },
  info: {
    icon: 'ℹ',
    color: 'var(--accent)',
    bgColor: 'var(--accent-bg)',
  },
};

// Individual toast component
function Toast({ id, message, type, onClose }) {
  const config = TOAST_CONFIG[type];

  return (
    <div
      style={{
        animation: 'slideIn 0.3s ease-out forwards',
        backgroundColor: config.bgColor,
        borderLeft: `4px solid ${config.color}`,
        borderRadius: 'var(--radius)',
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: 'var(--text)',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          fontSize: '18px',
          fontWeight: 'bold',
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
        }}
      >
        {config.icon}
      </span>
      <span
        style={{
          flex: '1',
          fontSize: '14px',
          lineHeight: '1.4',
        }}
      >
        {message}
      </span>
      <button
        onClick={() => onClose(id)}
        style={{
          flex: '0 0 auto',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.opacity = '1')}
        onMouseLeave={(e) => (e.target.style.opacity = '0.6')}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

// Toast container with styling
function ToastContainer({ toasts, onClose }) {
  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0',
            pointerEvents: 'auto',
          }}
        >
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Toast Provider
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    if (!TOAST_CONFIG[type]) {
      console.warn(`Invalid toast type: ${type}. Using 'info' instead.`);
      type = 'info';
    }

    const id = `${Date.now()}-${Math.random()}`;
    const toast = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    // Auto-remove after 4 seconds
    const timer = setTimeout(() => {
      removeToast(id);
    }, 4000);

    // Return a function to manually remove the toast
    return () => {
      clearTimeout(timer);
      removeToast(id);
    };
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, showToast: addToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}
