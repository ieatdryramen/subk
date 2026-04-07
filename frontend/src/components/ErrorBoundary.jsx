import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.heading}>Something went wrong</h1>
            <p style={styles.message}>
              We encountered an unexpected error. Please try reloading the page.
            </p>
            <button
              onClick={this.handleReload}
              style={styles.button}
              onMouseEnter={(e) => {
                e.target.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1';
              }}
            >
              Reload
            </button>
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
  },
  heading: {
    color: 'var(--text)',
    fontSize: '1.75rem',
    fontWeight: '600',
    marginBottom: '1rem',
    margin: 0,
  },
  message: {
    color: 'var(--text2)',
    fontSize: '1rem',
    lineHeight: '1.6',
    marginBottom: '2rem',
    margin: '1rem 0 2rem 0',
  },
  button: {
    backgroundColor: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'opacity 200ms ease',
    fontFamily: 'Jakarta Sans, system-ui, sans-serif',
  },
};

export default ErrorBoundary;
