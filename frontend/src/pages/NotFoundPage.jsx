import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

function NotFoundPage() {
  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.codeBlock}>
            <span style={styles.code}>404</span>
          </div>
          <h1 style={styles.heading}>Page not found</h1>
          <p style={styles.message}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/dashboard" style={styles.link}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 80px)',
    backgroundColor: 'var(--bg)',
    fontFamily: 'Jakarta Sans, system-ui, sans-serif',
    padding: '2rem',
  },
  content: {
    textAlign: 'center',
    maxWidth: '500px',
  },
  codeBlock: {
    marginBottom: '2rem',
  },
  code: {
    fontSize: '4rem',
    fontWeight: '700',
    color: 'var(--danger)',
    letterSpacing: '0.1em',
  },
  heading: {
    color: 'var(--text)',
    fontSize: '2rem',
    fontWeight: '600',
    marginBottom: '1rem',
    margin: '0 0 1rem 0',
  },
  message: {
    color: 'var(--text2)',
    fontSize: '1rem',
    lineHeight: '1.6',
    marginBottom: '2.5rem',
    margin: '0 0 2.5rem 0',
  },
  link: {
    display: 'inline-block',
    backgroundColor: 'var(--bg2)',
    color: 'var(--text)',
    textDecoration: 'none',
    padding: '0.75rem 2rem',
    borderRadius: 'var(--radius-lg)',
    fontSize: '1rem',
    fontWeight: '500',
    border: '1px solid var(--text2)',
    transition: 'all 200ms ease',
    cursor: 'pointer',
  },
};

export default NotFoundPage;
