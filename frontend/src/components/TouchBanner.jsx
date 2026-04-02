import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function TouchBanner() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/sequence/due/today').then(r => setData(r.data)).catch(() => {});
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      api.get('/sequence/due/today').then(r => setData(r.data)).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data || data.total === 0) return null;

  const hasOverdue = data.overdue.length > 0;

  return (
    <div
      onClick={() => navigate('/reminders')}
      style={{
        margin: '0 0.75rem 0.5rem',
        padding: '8px 12px',
        background: hasOverdue ? 'var(--danger-bg)' : 'rgba(245,158,11,0.1)',
        border: `1px solid ${hasOverdue ? 'var(--danger)' : 'var(--warning)'}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: hasOverdue ? 'var(--danger)' : 'var(--warning)', lineHeight: 1.4 }}>
        {hasOverdue
          ? `⚠ ${data.overdue.length} overdue · ${data.due.length} due today`
          : `🎯 ${data.due.length} touch${data.due.length !== 1 ? 'es' : ''} due today`
        }
      </div>
      <span style={{ fontSize: 11, color: hasOverdue ? 'var(--danger)' : 'var(--warning)', fontWeight: 500, flexShrink: 0 }}>
        Go →
      </span>
    </div>
  );
}
