import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const OUTCOMES = [
  { value: 'connected', label: '✅ Connected', color: 'var(--success)' },
  { value: 'voicemail', label: '📨 Left voicemail', color: 'var(--accent2)' },
  { value: 'no_answer', label: '📵 No answer', color: 'var(--text3)' },
  { value: 'busy', label: '🔴 Busy', color: 'var(--warning)' },
  { value: 'callback_requested', label: '📞 Callback requested', color: 'var(--accent2)' },
];

const s = {
  wrap: { padding: '4px 0' },
  callBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', marginBottom: 16 },
  callBtnIcon: { fontSize: 22 },
  callBtnText: { flex: 1 },
  callBtnTitle: { fontSize: 14, fontWeight: 600, color: 'var(--success)' },
  callBtnSub: { fontSize: 12, color: 'var(--text2)', marginTop: 1 },
  timer: { fontSize: 20, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--success)', fontVariantNumeric: 'tabular-nums' },
  logForm: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 },
  logTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' },
  outcomeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  outcomeBtn: (selected, color) => ({ padding: '8px 10px', borderRadius: 'var(--radius)', border: `1px solid ${selected ? color : 'var(--border)'}`, background: selected ? `${color}20` : 'var(--bg)', color: selected ? color : 'var(--text2)', fontSize: 12, fontWeight: selected ? 600 : 400, cursor: 'pointer', textAlign: 'left' }),
  notesArea: { width: '100%', marginBottom: 10, fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', minHeight: 60 },
  saveBtn: { padding: '9px 20px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' },
  historyTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },
  callItem: { display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' },
  callIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  callInfo: { flex: 1 },
  callOutcome: { fontSize: 13, fontWeight: 500 },
  callMeta: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  callNotes: { fontSize: 12, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' },
  empty: { fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' },
};

const formatDuration = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
};

export default function CallLogger({ leadId, lead }) {
  const [calls, setCalls] = useState([]);
  const [calling, setCalling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [outcome, setOutcome] = useState('connected');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const load = () => api.get(`/calls/${leadId}`).then(r => setCalls(r.data)).catch(() => {});
  useEffect(() => { load(); }, [leadId]);

  const startCall = () => {
    // Open phone dialer if mobile, or tel: link
    const phone = lead?.phone;
    if (phone) {
      window.open(`tel:${phone.replace(/\D/g, '')}`, '_self');
    }
    setCalling(true);
    setElapsed(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const endCall = () => {
    clearInterval(timerRef.current);
    setCalling(false);
    setShowLog(true);
  };

  const saveCall = async () => {
    setSaving(true);
    try {
      await api.post(`/calls/${leadId}/log`, {
        duration_seconds: elapsed,
        outcome,
        notes,
        called_at: new Date().toISOString(),
      });
      setShowLog(false);
      setNotes('');
      setOutcome('connected');
      setElapsed(0);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to log call');
    } finally {
      setSaving(false);
    }
  };

  const logManual = () => {
    setShowLog(true);
    setElapsed(0);
  };

  return (
    <div style={s.wrap}>
      {!calling && !showLog && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={s.callBtn} onClick={startCall}>
            <div style={s.callBtnIcon}>📞</div>
            <div style={s.callBtnText}>
              <div style={s.callBtnTitle}>Start call{lead?.phone ? ` · ${lead.phone}` : ''}</div>
              <div style={s.callBtnSub}>Opens dialer · Timer starts automatically</div>
            </div>
          </div>
          <button style={{ padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
            onClick={logManual}>Log manually</button>
        </div>
      )}

      {calling && (
        <div style={{ ...s.logForm, borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 2 }}>📞 Call in progress</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>with {lead?.full_name || 'prospect'}</div>
            </div>
            <div style={s.timer}>{formatDuration(elapsed)}</div>
          </div>
          <button style={{ ...s.saveBtn, background: 'var(--danger)', width: '100%' }} onClick={endCall}>
            End call & log outcome
          </button>
        </div>
      )}

      {showLog && (
        <div style={s.logForm}>
          <div style={s.logTitle}>Log call outcome{elapsed > 0 ? ` · ${formatDuration(elapsed)}` : ''}</div>
          <div style={s.outcomeGrid}>
            {OUTCOMES.map(o => (
              <button key={o.value} style={s.outcomeBtn(outcome === o.value, o.color)}
                onClick={() => setOutcome(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <textarea style={s.notesArea} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Call notes — what did they say? Next steps? Anything to remember..." />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.saveBtn} onClick={saveCall} disabled={saving}>
              {saving ? 'Saving...' : '✓ Log call · Sync to Zoho'}
            </button>
            <button style={{ ...s.saveBtn, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}
              onClick={() => setShowLog(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.historyTitle}>Call history</div>
      {calls.length === 0 ? (
        <div style={s.empty}>No calls logged yet</div>
      ) : calls.map(call => {
        const outcomeData = OUTCOMES.find(o => o.value === call.outcome) || OUTCOMES[0];
        return (
          <div key={call.id} style={s.callItem}>
            <div style={s.callIcon}>{outcomeData.label.split(' ')[0]}</div>
            <div style={s.callInfo}>
              <div style={{ ...s.callOutcome, color: outcomeData.color }}>{outcomeData.label.slice(3)}</div>
              <div style={s.callMeta}>
                {call.caller || 'You'} · {timeAgo(call.called_at)}
                {call.duration_seconds > 0 && ` · ${formatDuration(call.duration_seconds)}`}
              </div>
              {call.notes && <div style={s.callNotes}>"{call.notes}"</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
