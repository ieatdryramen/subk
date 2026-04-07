import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '1.5rem',
          width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto',
        }}>
        {title && (
          <div style={{
            fontSize: 17, fontWeight: 600, marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{title}</span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: 18, cursor: 'pointer', padding: '0 4px',
              }}>
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
