import React from 'react';

// ─── Error Monitoring Integration Point ───
// To enable Sentry error monitoring:
// 1. Install: npm install @sentry/react
// 2. In main.jsx, before ReactDOM.createRoot:
//    import * as Sentry from '@sentry/react';
//    Sentry.init({ dsn: 'YOUR_SENTRY_DSN', environment: 'production', tracesSampleRate: 0.1 });
// 3. Replace <ErrorBoundary> with <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
// 4. The captureError function below will auto-detect Sentry and forward errors

const captureError = (error, context = {}) => {
  // Sentry integration — auto-detected if installed
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, { extra: context });
    return;
  }

  // Fallback: structured console logging for server-side log aggregation
  const payload = {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...context,
  };
  console.error('[SumX Error]', JSON.stringify(payload));

  // Optional: send to backend error endpoint (uncomment when ready)
  // fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
};

// ─── Global Error Handlers ───
// These catch errors that escape React's error boundary (async errors, event handlers, etc.)
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    captureError(error || new Error(message), {
      type: 'window.onerror',
      source,
      lineno,
      colno,
    });
    // Don't prevent default — let browser console show the error too
    return false;
  };

  // Expose captureError globally for API interceptor
  window.__captureError = captureError;

  window.onunhandledrejection = (event) => {
    captureError(event.reason || new Error('Unhandled Promise rejection'), {
      type: 'unhandledrejection',
      promise: String(event.promise),
    });
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    captureError(error, {
      type: 'react_error_boundary',
      componentStack: errorInfo?.componentStack,
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h1 style={styles.heading}>Something went wrong</h1>
            <p style={styles.message}>
              An unexpected error occurred. You can try reloading the page or dismissing this message.
            </p>
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error details</summary>
                <pre style={styles.pre}>
                  {this.state.error.message}
                  {this.state.error.stack && '\n\n' + this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={this.handleDismiss} style={styles.btnSecondary}
                onMouseEnter={e => e.target.style.opacity = '0.8'}
                onMouseLeave={e => e.target.style.opacity = '1'}>
                Dismiss
              </button>
              <button onClick={this.handleReload} style={styles.button}
                onMouseEnter={e => e.target.style.opacity = '0.9'}
                onMouseLeave={e => e.target.style.opacity = '1'}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg)',
    fontFamily: 'Jakarta Sans, system-ui, sans-serif',
  },
  card: {
    backgroundColor: 'var(--bg2)',
    borderRadius: 'var(--radius-lg)',
    padding: '3rem',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    border: '1px solid var(--border)',
  },
  heading: {
    color: 'var(--text)',
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: '0 0 0.5rem 0',
  },
  message: {
    color: 'var(--text2)',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    margin: '0.5rem 0 1.5rem 0',
  },
  details: {
    textAlign: 'left',
    marginBottom: '1.5rem',
    padding: '12px',
    background: 'var(--bg3)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  summary: {
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text2)',
  },
  pre: {
    fontSize: 11,
    color: 'var(--danger)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: 8,
    maxHeight: 150,
    overflow: 'auto',
  },
  button: {
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '0.65rem 1.5rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 200ms ease',
    fontFamily: 'Jakarta Sans, system-ui, sans-serif',
  },
  btnSecondary: {
    backgroundColor: 'var(--bg3)',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.65rem 1.5rem',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'opacity 200ms ease',
    fontFamily: 'Jakarta Sans, system-ui, sans-serif',
  },
};

export { captureError };
export default ErrorBoundary;
