import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function UsageBanner() {
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/billing/status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  if (!status) return null;

  const pct = Math.round((status.playbooks_used / status.playbooks_limit) * 100);
  const remaining = status.playbooks_limit - status.playbooks_used;
  const isTrial = status.plan === 'trial';
  const isWarning = pct >= 70;
  const isMaxed = pct >= 100;

  if (!isWarning && !isTrial) return null;

  return (
    <div style={{
      padding: '8px 12px',
      background: isMaxed ? 'var(--danger-bg)' : isWarning ? 'var(--warning-bg)' : 'var(--accent-bg)',
      borderTop: `1px solid ${isMaxed ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)'}`,
      fontSize: 12,
    }}>
      <div style={{ color: isMaxed ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent2)', marginBottom: 4 }}>
        {isMaxed
          ? '⚠ Playbook limit reached'
          : isTrial
          ? `Free trial: ${remaining} playbook${remaining !== 1 ? 's' : ''} remaining`
          : `${remaining} playbooks remaining this month`}
      </div>
      <div style={{ height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isMaxed ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)', borderRadius: 2 }} />
      </div>
      <div
        style={{ color: isMaxed ? 'var(--danger)' : 'var(--accent2)', cursor: 'pointer', fontWeight: 500, fontSize: 11 }}
        onClick={() => navigate('/billing')}>
        {isMaxed ? 'Upgrade to continue →' : 'Upgrade plan →'}
      </div>
    </div>
  );
}
