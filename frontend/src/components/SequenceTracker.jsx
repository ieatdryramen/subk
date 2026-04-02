import { useState, useEffect } from 'react';
import api from '../lib/api';

const TOUCHPOINT_ICONS = {
  email1: '✉', email2: '✉', email3: '✉', email4: '✉',
  linkedin_connect: '🔗', linkedin_dm: '💬', call: '📞',
};

const s = {
  wrap: { padding: '4px 0' },
  grid: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: (status) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    background: status === 'done' ? 'var(--success-bg)' : status === 'skipped' ? 'var(--bg3)' : 'var(--bg)',
    border: `1px solid ${status === 'done' ? 'var(--success)' : status === 'skipped' ? 'var(--border)' : 'var(--border)'}`,
    borderRadius: 'var(--radius)', transition: 'all 0.15s',
  }),
  icon: { fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 },
  label: { flex: 1 },
  labelText: (status) => ({ fontSize: 13, fontWeight: 500, color: status === 'done' ? 'var(--success)' : status === 'skipped' ? 'var(--text3)' : 'var(--text)', textDecoration: status === 'skipped' ? 'line-through' : 'none' }),
  day: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  completedAt: { fontSize: 11, color: 'var(--success)', marginTop: 1 },
  actions: { display: 'flex', gap: 6, flexShrink: 0 },
  btn: (variant) => ({
    padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer',
    background: variant === 'done' ? 'var(--success-bg)' : variant === 'skip' ? 'var(--bg3)' : variant === 'undo' ? 'var(--warning-bg)' : 'var(--accent-bg)',
    color: variant === 'done' ? 'var(--success)' : variant === 'skip' ? 'var(--text3)' : variant === 'undo' ? 'var(--warning)' : 'var(--accent2)',
    border: variant === 'done' ? '1px solid var(--success)' : variant === 'skip' ? '1px solid var(--border)' : variant === 'undo' ? '1px solid var(--warning)' : '1px solid var(--accent)',
  }),
  noteInput: { fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 160 },
  progress: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressBar: { flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: (pct) => ({ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }),
  progressLabel: { fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' },
};

export default function SequenceTracker({ leadId }) {
  const [sequence, setSequence] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get(`/sequence/${leadId}`).then(r => {
      setSequence(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [leadId]);

  const mark = async (touchpoint, status) => {
    try {
      await api.post(`/sequence/${leadId}/touch`, { touchpoint, status, notes: notes[touchpoint] || '' });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '1rem 0' }}>Loading sequence...</div>;

  const doneCount = sequence.filter(s => s.status === 'done').length;
  const pct = Math.round((doneCount / sequence.length) * 100);

  return (
    <div style={s.wrap}>
      <div style={s.progress}>
        <div style={s.progressBar}><div style={s.progressFill(pct)} /></div>
        <div style={s.progressLabel}>{doneCount}/{sequence.length} touchpoints completed</div>
      </div>
      <div style={s.grid}>
        {sequence.map(tp => (
          <div key={tp.key} style={s.row(tp.status)}>
            <div style={s.icon}>{TOUCHPOINT_ICONS[tp.key] || '•'}</div>
            <div style={s.label}>
              <div style={s.labelText(tp.status)}>{tp.label}</div>
              {tp.status === 'done' && tp.completed_at
                ? <div style={s.completedAt}>
                    ✓ {new Date(tp.completed_at).toLocaleDateString()}{tp.notes ? ` — ${tp.notes}` : ''}
                    {tp.opened_at && <span style={{ marginLeft: 8, color: 'var(--success)', fontSize: 10 }}>👁 Opened</span>}
                    {tp.clicked_at && <span style={{ marginLeft: 6, color: 'var(--accent2)', fontSize: 10 }}>🔗 Clicked</span>}
                  </div>
                : <div style={s.day}>{tp.day}</div>}
            </div>
            <div style={s.actions}>
              {tp.status === 'pending' && (
                <>
                  <input
                    style={s.noteInput}
                    placeholder="Add note (optional)"
                    value={notes[tp.key] || ''}
                    onChange={e => setNotes(n => ({ ...n, [tp.key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && mark(tp.key, 'done')}
                  />
                  <button style={s.btn('done')} onClick={() => mark(tp.key, 'done')}>✓ Done</button>
                  <button style={s.btn('skip')} onClick={() => mark(tp.key, 'skipped')}>Skip</button>
                </>
              )}
              {tp.status === 'done' && (
                <button style={s.btn('undo')} onClick={() => mark(tp.key, 'pending')}>Undo</button>
              )}
              {tp.status === 'skipped' && (
                <button style={s.btn('undo')} onClick={() => mark(tp.key, 'pending')}>Restore</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
