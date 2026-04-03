import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const TOUCHPOINT_ICONS = {
  email1: '✉', email2: '✉', email3: '✉', email4: '✉',
  call1: '📞', call2: '📞', call3: '📞', call4: '📞',
  linkedin_connect: '🔗', linkedin_dm: '💬',
  call: '📞', mefu: '📅',
};

const TYPE_COLORS = {
  email: { bg: 'var(--accent-bg)', border: 'var(--accent)', color: 'var(--accent2)' },
  call: { bg: 'rgba(34,197,94,0.08)', border: 'var(--success)', color: 'var(--success)' },
  linkedin: { bg: 'rgba(0,119,181,0.08)', border: '#0077b5', color: '#0077b5' },
};

const s = {
  wrap: { padding: '4px 0' },
  grid: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: (status, dragging) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    background: status === 'done' ? 'var(--success-bg)' : status === 'skipped' ? 'var(--bg3)' : 'var(--bg)',
    border: `1px solid ${status === 'done' ? 'var(--success)' : status === 'skipped' ? 'var(--border)' : 'var(--border)'}`,
    borderRadius: 'var(--radius)', transition: 'all 0.15s',
    opacity: dragging ? 0.4 : 1,
    cursor: 'default',
  }),
  dragHandle: { color: 'var(--text3)', fontSize: 14, cursor: 'grab', padding: '0 4px', userSelect: 'none', flexShrink: 0 },
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
  noteInput: { fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 140 },
  progress: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressBar: { flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: (pct) => ({ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }),
  progressLabel: { fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' },
  configBar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  typeBadge: (type) => ({ fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600, background: TYPE_COLORS[type]?.bg || 'var(--bg3)', color: TYPE_COLORS[type]?.color || 'var(--text3)', border: `1px solid ${TYPE_COLORS[type]?.border || 'var(--border)'}`, flexShrink: 0 }),
  dropZone: (active) => ({ height: 4, borderRadius: 2, background: active ? 'var(--accent)' : 'transparent', transition: 'all 0.15s', margin: '2px 0' }),
};

export default function SequenceTracker({ leadId }) {
  const [sequence, setSequence] = useState([]);
  const [notes, setNotes] = useState({});
  const [callOutcomes, setCallOutcomes] = useState({});
  const [showOutcomePicker, setShowOutcomePicker] = useState({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const dragItem = useRef(null);

  const load = () => {
    api.get(`/sequence/${leadId}`).then(r => {
      setSequence(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const loadConfig = () => {
    api.get('/sequence/config').then(r => setConfig(r.data)).catch(() => {});
  };

  useEffect(() => { load(); loadConfig(); }, [leadId]);

  const mark = async (touchpoint, status, call_outcome) => {
    try {
      await api.post(`/sequence/${leadId}/touch`, { touchpoint, status, notes: notes[touchpoint] || '', call_outcome });
      setShowOutcomePicker(p => ({ ...p, [touchpoint]: false }));
      load();
    } catch (err) { console.error(err); }
  };

  const isCallTouchpoint = (key) => key.startsWith('call') || key === 'mefu';

  // Drag handlers for reorder
  const onDragStart = (e, idx) => {
    dragItem.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    setDropIdx(idx);
  };
  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === idx) { setDraggingIdx(null); setDropIdx(null); return; }
    const newConfig = [...(config || sequence)];
    const [moved] = newConfig.splice(dragItem.current, 1);
    newConfig.splice(idx, 0, moved);
    setConfig(newConfig);
    setSequence(newConfig.map(tp => sequence.find(s => s.key === tp.key) || tp));
    dragItem.current = null;
    setDraggingIdx(null);
    setDropIdx(null);
  };
  const onDragEnd = () => { setDraggingIdx(null); setDropIdx(null); };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const toSave = (config || sequence).map(tp => ({ key: tp.key, label: tp.label, day: tp.day, type: tp.type }));
      await api.put('/sequence/config', { config: toSave });
      setEditMode(false);
    } catch (err) { alert('Failed to save sequence order'); }
    finally { setSavingConfig(false); }
  };

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '1rem 0' }}>Loading sequence...</div>;

  const doneCount = sequence.filter(s => s.status === 'done').length;
  const pct = Math.round((doneCount / sequence.length) * 100);

  return (
    <div style={s.wrap}>
      <div style={s.progress}>
        <div style={s.progressBar}><div style={s.progressFill(pct)} /></div>
        <div style={s.progressLabel}>{doneCount}/{sequence.length} touchpoints completed</div>
        <button style={{ ...s.btn(editMode ? 'undo' : 'skip'), padding: '3px 8px', fontSize: 10 }}
          onClick={() => editMode ? saveConfig() : setEditMode(true)}>
          {editMode ? (savingConfig ? 'Saving...' : '✓ Save Order') : '⋮ Reorder'}
        </button>
        {editMode && (
          <button style={{ ...s.btn('skip'), padding: '3px 8px', fontSize: 10 }} onClick={() => { setEditMode(false); load(); loadConfig(); }}>Cancel</button>
        )}
      </div>

      {editMode && (
        <div style={s.configBar}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>⟵ Drag rows to reorder your sequence. Changes apply to all new leads.</span>
        </div>
      )}

      <div style={s.grid}>
        {sequence.map((tp, idx) => (
          <div key={tp.key}>
            {editMode && dropIdx === idx && <div style={s.dropZone(true)} />}
            <div
              style={s.row(tp.status, draggingIdx === idx)}
              draggable={editMode}
              onDragStart={editMode ? e => onDragStart(e, idx) : undefined}
              onDragOver={editMode ? e => onDragOver(e, idx) : undefined}
              onDrop={editMode ? e => onDrop(e, idx) : undefined}
              onDragEnd={editMode ? onDragEnd : undefined}>
              {editMode && <span style={s.dragHandle}>⠿</span>}
              <div style={s.icon}>{TOUCHPOINT_ICONS[tp.key] || '•'}</div>
              <div style={s.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.labelText(tp.status)}>{tp.label}</span>
                  {tp.type && <span style={s.typeBadge(tp.type)}>{tp.type}</span>}
                </div>
                {tp.status === 'done' && tp.completed_at
                  ? <div style={s.completedAt}>
                      ✓ {new Date(tp.completed_at).toLocaleDateString()}{tp.notes ? ` — ${tp.notes}` : ''}
                      {tp.call_outcome && <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 8, background: tp.call_outcome === 'meeting_booked' ? 'var(--success-bg)' : 'var(--bg3)', color: tp.call_outcome === 'meeting_booked' ? 'var(--success)' : 'var(--text3)', border: '1px solid currentColor' }}>
                        {tp.call_outcome === 'voicemail' ? '📨 Voicemail' : tp.call_outcome === 'connected_followup' ? '📞 Connected' : tp.call_outcome === 'meeting_booked' ? '🗓 Meeting Booked!' : tp.call_outcome === 'not_interested' ? '🚫 Not interested' : tp.call_outcome}
                      </span>}
                      {tp.opened_at && <span style={{ marginLeft: 8, color: 'var(--success)', fontSize: 10 }}>👁 Opened</span>}
                      {tp.clicked_at && <span style={{ marginLeft: 6, color: 'var(--accent2)', fontSize: 10 }}>🔗 Clicked</span>}
                    </div>
                  : <div style={s.day}>{tp.day}</div>}
              </div>
              {!editMode && (
                <div style={s.actions} className="pf-sequence-actions">
                  {tp.status === 'pending' && (
                    <>
                      <input
                        style={s.noteInput}
                        placeholder="Add note (optional)"
                        value={notes[tp.key] || ''}
                        onChange={e => setNotes(n => ({ ...n, [tp.key]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && !isCallTouchpoint(tp.key) && mark(tp.key, 'done')}
                      />
                      {isCallTouchpoint(tp.key) ? (
                        showOutcomePicker[tp.key] ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {[
                              { key: 'voicemail', label: '📨 Voicemail' },
                              { key: 'connected_followup', label: '📞 Connected' },
                              { key: 'meeting_booked', label: '🗓 Meeting!' },
                              { key: 'not_interested', label: '🚫 No' },
                            ].map(o => (
                              <button key={o.key} style={{ ...s.btn(o.key === 'meeting_booked' ? 'done' : 'skip'), fontSize: 10, padding: '3px 8px' }}
                                onClick={() => mark(tp.key, 'done', o.key)}>
                                {o.label}
                              </button>
                            ))}
                            <button style={{ ...s.btn('skip'), fontSize: 10, padding: '3px 8px' }}
                              onClick={() => setShowOutcomePicker(p => ({ ...p, [tp.key]: false }))}>✕</button>
                          </div>
                        ) : (
                          <button style={s.btn('done')} onClick={() => setShowOutcomePicker(p => ({ ...p, [tp.key]: true }))}>✓ Done</button>
                        )
                      ) : (
                        <button style={s.btn('done')} onClick={() => mark(tp.key, 'done')}>✓ Done</button>
                      )}
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
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

