import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function PwinBadge({ opportunityId }) {
  const [pwin, setPwin] = useState(null);
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    loadPwin();
  }, [opportunityId]);

  const loadPwin = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/opportunities/${opportunityId}/pwin`);
      setPwin(res.pwin);
      setFactors(res.factors || []);
    } catch (err) {
      console.error('Pwin error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'inline-block',
        width: 40,
        height: 24,
        background: 'var(--border)',
        borderRadius: 'var(--radius)',
      }} />
    );
  }

  if (!pwin && pwin !== 0) {
    return null;
  }

  const color = pwin < 30 ? 'var(--danger)' : pwin < 60 ? 'var(--warning)' : 'var(--success)';
  const backgroundColor = pwin < 30 ? 'rgba(239, 68, 68, 0.1)' : pwin < 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)';

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 24,
          background: backgroundColor,
          border: `1px solid ${color}`,
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          color,
        }}
      >
        {pwin}%
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg3)',
            border: `1px solid var(--border)`,
            borderRadius: 'var(--radius)',
            padding: '0.75rem',
            minWidth: 220,
            fontSize: 12,
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Pwin Score: {pwin}%</div>
          {factors.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>Contributing Factors:</div>
              {factors.map((f, i) => (
                <div key={i} style={{ marginBottom: 4, paddingLeft: 8 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {f.name}: +{f.score}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    {f.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
