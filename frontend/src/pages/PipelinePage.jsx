import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const EMAIL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'email1_sent', label: 'Email 1 Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'email2_sent', label: 'Email 2 Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'email3_sent', label: 'Email 3 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'email4_sent', label: 'Email 4 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'replied', label: 'Replied ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const CALL_STAGES = [
  { key: 'not_started', label: 'Not Called', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'call_attempted', label: 'Attempted', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'call_connected', label: 'Connected', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'call_voicemail', label: 'Voicemail', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { key: 'call_booked', label: 'Meeting Booked', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const LINKEDIN_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'linkedin_connected', label: 'Connected', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'linkedin_dm_sent', label: 'DM Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'linkedin_replied', label: 'Replied', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const ALL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'in_progress_1', label: 'Touch 1 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_2', label: 'Touch 2 🔗', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'in_progress_3', label: 'Touch 3 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_4', label: 'Touch 4 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_5', label: 'Touch 5 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_6', label: 'Touch 6 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_7', label: 'Touch 7 💬', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'in_progress_8', label: 'Touch 8 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_9', label: 'Touch 9 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_10', label: 'Touch 10 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'mefu', label: 'MEFU 📅', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'meeting_booked', label: '🗓 Meeting Booked', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { key: 'completed', label: 'Completed ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const VIEW_MODES = [
  { key: 'all', label: '📋 All', stages: ALL_STAGES, stageField: 'sequence_stage' },
  { key: 'email', label: '✉ Email', stages: EMAIL_STAGES, stageField: 'email_stage' },
  { key: 'call', label: '📞 Calls', stages: CALL_STAGES, stageField: 'call_stage' },
  { key: 'linkedin', label: '🔗 LinkedIn', stages: LINKEDIN_STAGES, stageField: 'linkedin_stage' },
];

const TOUCH_ICONS = { email: '✉', call: '📞', linkedin: '🔗' };
const URGENCY_COLORS = {
  done: { color: 'var(--success)', bg: 'rgba(34,197,94,0.1)', label: 'Done' },
  overdue: { color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' },
  due: { color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)', label: 'Due Today' },
  upcoming: { color: 'var(--text3)', bg: 'var(--bg3)', label: 'Upcoming' },
};

/* ─── Lead Detail Slide-Out Panel ─── */
const LeadDetailPanel = ({ lead, onClose, showToast, onLeadUpdated }) => {
  const [sequence, setSequence] = useState([]);
  const [seqLoading, setSeqLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setPanelVisible(true));
  }, []);

  // Escape key
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Fetch sequence
  useEffect(() => {
    if (!lead) return;
    setSeqLoading(true);
    api.get(`/sequence/${lead.id}`)
      .then(r => { setSequence(Array.isArray(r.data) ? r.data : []); setSeqLoading(false); })
      .catch(() => { setSequence([]); setSeqLoading(false); });
  }, [lead?.id]);

  const handleClose = () => {
    setPanelVisible(false);
    setTimeout(onClose, 200);
  };

  const startEdit = () => {
    setEditForm({
      full_name: lead.full_name || '',
      company: lead.company || '',
      title: lead.title || '',
      email: lead.email || '',
      phone: lead.phone || '',
      linkedin: lead.linkedin || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/lists/${lead.list_id}/leads/${lead.id}`, editForm);
      showToast('Lead updated', 'success');
      setEditing(false);
      if (onLeadUpdated) onLeadUpdated({ ...lead, ...editForm });
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const logNote = async () => {
    if (!noteText.trim()) return;
    // Find next pending touch to attach note to
    const nextTouch = sequence.find(t => t.status !== 'done');
    if (!nextTouch) { showToast('No pending touch to log note against', 'error'); return; }
    try {
      await api.post(`/sequence/${lead.id}/touch`, {
        touchpoint: nextTouch.key,
        status: 'pending',
        notes: noteText.trim(),
      });
      showToast('Note saved', 'success');
      setNoteText('');
      setNoteOpen(false);
      // Refresh sequence
      const r = await api.get(`/sequence/${lead.id}`);
      setSequence(Array.isArray(r.data) ? r.data : []);
    } catch { showToast('Failed to save note', 'error'); }
  };

  const advanceStage = async () => {
    const nextTouch = sequence.find(t => t.status !== 'done');
    if (!nextTouch) { showToast('All touches completed', 'success'); return; }
    try {
      await api.post(`/sequence/${lead.id}/touch`, {
        touchpoint: nextTouch.key,
        status: 'done',
        notes: '',
      });
      showToast(`Completed: ${nextTouch.label}`, 'success');
      const r = await api.get(`/sequence/${lead.id}`);
      setSequence(Array.isArray(r.data) ? r.data : []);
    } catch { showToast('Failed to advance', 'error'); }
  };

  const completedTouches = sequence.filter(t => t.status === 'done').sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  const nextTouch = sequence.find(t => t.status !== 'done');
  const doneCount = sequence.filter(t => t.status === 'done' && !t.is_mefu).length;
  const totalCount = sequence.filter(t => !t.is_mefu).length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const icpColor = lead.icp_score >= 70 ? 'var(--success)' : lead.icp_score >= 40 ? 'var(--warning)' : 'var(--text3)';
  const icpBg = lead.icp_score >= 70 ? 'rgba(34,197,94,0.12)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.12)' : 'var(--bg3)';

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' };

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        opacity: panelVisible ? 1 : 0, transition: 'opacity 0.2s',
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)', zIndex: 201, overflowY: 'auto',
        transform: panelVisible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{lead.full_name || lead.email || 'Unknown'}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{lead.title || ''}{lead.title && lead.company ? ' at ' : ''}{lead.company || ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {lead.icp_score != null && (
                <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, background: icpBg, color: icpColor }}>
                  {lead.icp_score}
                </div>
              )}
              <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>✕</button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>{doneCount}/{totalCount} touches completed</span>
              <span style={{ fontWeight: 600, color: pct >= 80 ? 'var(--success)' : 'var(--text2)' }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Contact Info */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Contact Info</div>
              {!editing && (
                <button onClick={startEdit} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
                  ✏ Edit
                </button>
              )}
            </div>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'full_name', label: 'Name', icon: '👤' },
                  { key: 'company', label: 'Company', icon: '🏢' },
                  { key: 'title', label: 'Title', icon: '💼' },
                  { key: 'email', label: 'Email', icon: '✉' },
                  { key: 'phone', label: 'Phone', icon: '📞' },
                  { key: 'linkedin', label: 'LinkedIn', icon: '🔗' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, width: 20, textAlign: 'center' }}>{f.icon}</span>
                    <input value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.label} style={inputStyle} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={saveEdit} disabled={saving}
                    style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: '✉', val: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
                  { icon: '📞', val: lead.phone, href: lead.phone ? `tel:${lead.phone}` : null },
                  { icon: '🔗', val: lead.linkedin ? 'LinkedIn Profile' : null, href: lead.linkedin },
                ].map((c, i) => c.val ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 20, textAlign: 'center' }}>{c.icon}</span>
                    {c.href ? <a href={c.href} target={c.icon === '🔗' ? '_blank' : undefined} rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{c.val}</a> : <span>{c.val}</span>}
                  </div>
                ) : null)}
                {!lead.email && !lead.phone && !lead.linkedin && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No contact info — click Edit to add</div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { icon: '✉', label: 'Send Email', action: () => showToast('Email composer coming in v3.11.0', 'info') },
                { icon: '📞', label: 'Log Call', action: () => showToast('Call logged', 'success') },
                { icon: '📝', label: 'Add Note', action: () => setNoteOpen(!noteOpen) },
                { icon: '→', label: nextTouch ? `Complete: ${nextTouch.label}` : 'All Done', action: advanceStage },
              ].map((a, i) => (
                <button key={i} onClick={a.action}
                  style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: i === 3 ? 'var(--accent)' : 'var(--bg)', color: i === 3 ? '#fff' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
            {noteOpen && (
              <div style={{ marginTop: 8 }}>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note about this lead..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', minHeight: 60 }} />
                <button onClick={logNote}
                  style={{ marginTop: 4, padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                  Save Note
                </button>
              </div>
            )}
          </div>

          {/* Playbook Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Playbook Timeline</div>
            {seqLoading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading sequence...</div>
            ) : sequence.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>No playbook assigned yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {sequence.map((tp, i) => {
                  const urg = URGENCY_COLORS[tp.urgency] || URGENCY_COLORS.upcoming;
                  const isNext = tp === nextTouch;
                  return (
                    <div key={tp.key} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                      {/* Timeline line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, flexShrink: 0,
                          background: tp.status === 'done' ? 'var(--success)' : isNext ? 'var(--accent)' : 'var(--bg3)',
                          color: tp.status === 'done' || isNext ? '#fff' : 'var(--text3)',
                          border: isNext ? '2px solid var(--accent)' : 'none',
                        }}>
                          {tp.status === 'done' ? '✓' : TOUCH_ICONS[tp.type] || '·'}
                        </div>
                        {i < sequence.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 16, background: tp.status === 'done' ? 'var(--success)' : 'var(--border)' }} />
                        )}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, paddingBottom: 12, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: isNext ? 600 : 400, color: isNext ? 'var(--text)' : 'var(--text2)' }}>
                            {tp.label}
                          </span>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, fontWeight: 500, background: urg.bg, color: urg.color }}>
                            {urg.label}
                          </span>
                        </div>
                        {tp.completed_at && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                            {new Date(tp.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                        {tp.due_date && tp.status !== 'done' && (
                          <div style={{ fontSize: 11, color: tp.urgency === 'overdue' ? 'var(--danger)' : 'var(--text3)', marginTop: 2 }}>
                            Due: {new Date(tp.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                        {tp.notes && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, padding: '4px 8px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            {tp.notes}
                          </div>
                        )}
                        {tp.call_outcome && (
                          <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2 }}>Outcome: {tp.call_outcome.replace(/_/g, ' ')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Timeline (completed touches reverse-chrono) */}
          {completedTouches.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Activity Log</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {completedTouches.map(tp => (
                  <div key={tp.key} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{TOUCH_ICONS[tp.type] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{tp.label}</div>
                      {tp.notes && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{tp.notes}</div>}
                      {tp.call_outcome && <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 1 }}>{tp.call_outcome.replace(/_/g, ' ')}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {tp.completed_at ? new Date(tp.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ─── Main Pipeline Page ─── */
export default function PipelinePage() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('all');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [viewMode, setViewMode] = useState('all');
  const [search, setSearch] = useState('');
  const [icpFilter, setIcpFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveProgress, setBulkMoveProgress] = useState(0);
  const [moveError, setMoveError] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentView = VIEW_MODES.find(v => v.key === viewMode);
  const STAGES = currentView.stages;
  const stageField = currentView.stageField;

  useEffect(() => {
    api.get('/lists').then(r => setLists(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!lists.length) return;
    setLoading(true);
    const toLoad = selectedList === 'all' ? lists : lists.filter(l => String(l.id) === selectedList);
    Promise.all(toLoad.map(list => api.get(`/lists/${list.id}/leads`).then(r => Array.isArray(r.data) ? r.data : r.data.leads || [])))
      .then(results => { setLeads(results.flat().filter(l => l.status === 'done')); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedList, lists]);

  // Clear selection when view changes
  useEffect(() => { setSelectedIds(new Set()); setBulkStage(''); }, [viewMode]);

  const moveStage = async (leadId, newStage) => {
    const prev = leads.find(l => l.id === leadId);
    const prevStage = prev ? prev[stageField] : null;
    const prevSeqStage = prev ? prev.sequence_stage : null;
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, [stageField]: newStage, sequence_stage: viewMode === 'all' ? newStage : l.sequence_stage } : l));
    try {
      await api.post(`/sequence/${leadId}/stage`, { stage: newStage, field: stageField });
    } catch (err) {
      console.error(err);
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, [stageField]: prevStage, sequence_stage: prevSeqStage } : l));
      showToast('Failed to move lead — reverted', 'error');
    }
  };

  const bulkMove = async () => {
    if (!bulkStage || !selectedIds.size) return;
    setBulkMoving(true);
    setBulkMoveProgress(0);
    setMoveError(null);
    const ids = [...selectedIds];
    const total = ids.length;
    const snapshot = leads.filter(l => selectedIds.has(l.id)).map(l => ({ id: l.id, [stageField]: l[stageField], sequence_stage: l.sequence_stage }));
    setLeads(ls => ls.map(l => selectedIds.has(l.id) ? { ...l, [stageField]: bulkStage, sequence_stage: viewMode === 'all' ? bulkStage : l.sequence_stage } : l));
    let failed = 0;
    try {
      const batchSize = 10;
      let done = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(id =>
          api.post(`/sequence/${id}/stage`, { stage: bulkStage, field: stageField })
        ));
        failed += results.filter(r => r.status === 'rejected').length;
        done += batch.length;
        setBulkMoveProgress(Math.round((done / total) * 100));
      }
    } catch (err) {
      console.error(err);
      failed = total;
    }
    if (failed > 0) {
      setLeads(ls => ls.map(l => {
        const snap = snapshot.find(s => s.id === l.id);
        return snap ? { ...l, [stageField]: snap[stageField], sequence_stage: snap.sequence_stage } : l;
      }));
      showToast(`${failed} of ${total} leads failed to move — reverted`, 'error');
    } else {
      showToast(`${total} leads moved successfully`, 'success');
    }
    setBulkMoving(false);
    setBulkMoveProgress(0);
    setSelectedIds(new Set());
    setBulkStage('');
  };

  const toggleSelect = (e, leadId) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStage(''); };

  const openLeadDetail = (e, lead) => {
    // Don't open if bulk selection is active or if clicking checkbox/button
    if (selectedIds.size > 0) return;
    e.stopPropagation();
    setDetailLead(lead);
  };

  const onDragStart = (e, leadId) => {
    if (selectedIds.size === 0) {
      setDraggedId(leadId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', leadId);
      e.currentTarget.style.opacity = '0.5';
    }
  };
  const onDragEnd = (e) => { setDraggedId(null); setDragOverStage(null); e.currentTarget.style.opacity = '1'; };
  const onDragOver = (e, stageKey) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stageKey); };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    const lid = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(lid) && lid && stageKey) moveStage(lid, stageKey);
    setDragOverStage(null); setDraggedId(null);
  };

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search || (l.full_name || '').toLowerCase().includes(search.toLowerCase()) || (l.company || '').toLowerCase().includes(search.toLowerCase());
    const matchIcp = icpFilter === 'all' || (icpFilter === 'high' && l.icp_score >= 70) || (icpFilter === 'mid' && l.icp_score >= 40 && l.icp_score < 70) || (icpFilter === 'low' && (l.icp_score == null || l.icp_score < 40));
    return matchSearch && matchIcp;
  });

  const getStageLeads = (key) => filteredLeads.filter(l => (l[stageField] || l.sequence_stage || 'not_started') === key);

  const total = filteredLeads.length;
  const inProgress = filteredLeads.filter(l => {
    const s = l[stageField] || l.sequence_stage || '';
    return s.includes('in_progress') || ['email1_sent','email2_sent','email3_sent','call_attempted','call_connected','call_voicemail','linkedin_connected','linkedin_dm_sent'].includes(s);
  }).length;
  const completed = filteredLeads.filter(l => ['completed','replied','call_booked','linkedin_replied'].includes(l[stageField] || l.sequence_stage || '')).length;
  const notStarted = filteredLeads.filter(l => !l[stageField] && (!l.sequence_stage || l.sequence_stage === 'not_started')).length;
  const meetingBooked = filteredLeads.filter(l => (l[stageField] || l.sequence_stage || '') === 'meeting_booked').length;
  const mefu = filteredLeads.filter(l => (l[stageField] || l.sequence_stage || '') === 'mefu').length;
  const engagementRate = total > 0 ? Math.round(((inProgress + completed) / total) * 100) : 0;

  const scoredLeads = filteredLeads.filter(l => l.icp_score != null);
  const avgIcp = scoredLeads.length > 0 ? Math.round(scoredLeads.reduce((a, l) => a + l.icp_score, 0) / scoredLeads.length) : 0;

  const btnBase = { padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' };

  return (
    <Layout>
      <style>{`@media (max-width: 768px) { .pf-stat-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
      <div style={{ padding: '2rem 2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Pipeline</div>
            <div style={{ color: 'var(--text2)', fontSize: 13 }}>
              Click a lead to view details · drag between stages · check boxes for bulk actions
            </div>
          </div>
          {total > 0 && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: engagementRate >= 30 ? 'var(--success)' : 'var(--warning)' }}>{engagementRate}%</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Engaged</div>
              </div>
              <div style={{ width: 1, height: 30, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent2)' }}>{avgIcp}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Avg ICP</div>
              </div>
              <div style={{ width: 1, height: 30, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: meetingBooked > 0 ? 'var(--success)' : 'var(--text3)' }}>{meetingBooked}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Meetings</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { n: total, l: 'Total leads', c: 'var(--text)', icon: '👤' },
            { n: notStarted, l: 'Not started', c: 'var(--text3)', icon: '⏸' },
            { n: inProgress, l: 'In progress', c: 'var(--accent2)', icon: '▶' },
            { n: completed, l: 'Completed', c: 'var(--success)', icon: '✓' },
            { n: mefu, l: 'MEFU', c: 'var(--warning)', icon: '📅' },
          ].map(x => (
            <div key={x.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: x.c }}>{x.n}</div>
                <span style={{ fontSize: 14, opacity: 0.3 }}>{x.icon}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>{x.l}</div>
            </div>
          ))}
        </div>

        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>No leads in pipeline yet</div>
            <div style={{ fontSize: 14, maxWidth: 400, margin: '0 auto 20px' }}>
              Start by adding leads to your pipeline. Build a list, assign a playbook, and watch them move through stages as you execute.
            </div>
            <button
              onClick={() => navigate('/lists')}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              Go to Lead Lists
            </button>
          </div>
        ) : (
          <>
            {/* View mode tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
              {VIEW_MODES.map(v => (
                <button key={v.key}
                  style={{ ...btnBase, background: viewMode === v.key ? 'var(--accent)' : 'var(--bg2)', color: viewMode === v.key ? '#fff' : 'var(--text2)', borderColor: viewMode === v.key ? 'var(--accent)' : 'var(--border)' }}
                  onClick={() => setViewMode(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: selectedIds.size > 0 ? 8 : '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
                style={{ fontSize: 13, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 200 }} />
              <select value={selectedList} onChange={e => setSelectedList(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 'auto' }}>
                <option value="all">All lists</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select value={icpFilter} onChange={e => setIcpFilter(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 'auto' }}>
                <option value="all">All ICP scores</option>
                <option value="high">High ICP (70+)</option>
                <option value="mid">Mid ICP (40-69)</option>
                <option value="low">Low / Unscored</option>
              </select>
              <button style={{ ...btnBase, background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, padding: '7px 12px' }} onClick={selectAll}>
                Select all ({filteredLeads.length})
              </button>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {loading ? 'Loading...' : `${total} leads`}
              </span>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'center', padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent2)' }}>{selectedIds.size} selected</span>
                <span style={{ color: 'var(--border)', fontSize: 13 }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Move to:</span>
                <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
                  style={{ fontSize: 13, padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
                  <option value="">— pick a stage —</option>
                  {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
                <button
                  style={{ ...btnBase, background: bulkStage ? 'var(--accent)' : 'var(--bg3)', color: bulkStage ? '#fff' : 'var(--text3)', borderColor: bulkStage ? 'var(--accent)' : 'var(--border)', padding: '5px 14px', fontSize: 12 }}
                  onClick={bulkMove} disabled={!bulkStage || bulkMoving}>
                  {bulkMoving ? `Moving... ${bulkMoveProgress}%` : '→ Move'}
                </button>
                <button style={{ ...btnBase, background: 'transparent', color: 'var(--text3)', padding: '5px 10px', fontSize: 12 }} onClick={clearSelection}>
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Kanban board */}
            <div className="pf-kanban" style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {STAGES.map(stage => {
                const stageLeads = getStageLeads(stage.key);
                const isOver = dragOverStage === stage.key;
                return (
                  <div key={stage.key}
                    style={{ background: isOver ? stage.bg : 'var(--bg2)', border: `1px solid ${isOver ? stage.color : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', minHeight: 200, transition: 'all 0.15s' }}
                    onDragOver={e => onDragOver(e, stage.key)}
                    onDrop={e => onDrop(e, stage.key)}
                    onDragLeave={() => setDragOverStage(null)}>
                    <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stage.label}</span>
                      <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 6px', borderRadius: 10 }}>{loading ? '—' : stageLeads.length}</span>
                    </div>
                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {loading ? (
                        <>
                          {[1, 2, 3].map(i => (
                            <div key={`skeleton-${i}`}
                              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 10px', height: 70, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                            />
                          ))}
                        </>
                      ) : (
                        <>
                          {stageLeads.map(lead => {
                            const isSelected = selectedIds.has(lead.id);
                            return (
                              <div key={lead.id}
                                draggable={selectedIds.size === 0}
                                onDragStart={e => onDragStart(e, lead.id)}
                                onDragEnd={onDragEnd}
                                style={{ background: isSelected ? 'var(--accent-bg)' : draggedId === lead.id ? 'var(--bg3)' : 'var(--bg)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '9px 10px', cursor: selectedIds.size > 0 ? 'pointer' : 'grab', userSelect: 'none', transition: 'all 0.15s' }}
                                onClick={e => selectedIds.size > 0 ? toggleSelect(e, lead.id) : openLeadDetail(e, lead)}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => toggleSelect(e, lead.id)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer', width: 14, height: 14 }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {lead.full_name || lead.email || '—'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {lead.company || lead.title || '—'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      {lead.icp_score != null ? (
                                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: lead.icp_score >= 70 ? 'rgba(34,197,94,0.15)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.15)' : 'var(--bg3)', color: lead.icp_score >= 70 ? '#22c55e' : lead.icp_score >= 40 ? '#f59e0b' : 'var(--text3)' }}>
                                          {lead.icp_score}
                                        </span>
                                      ) : <span />}
                                      <button style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                                        onClick={e => { e.stopPropagation(); navigate(`/lists/${lead.list_id}`); }}>→</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {stageLeads.length === 0 && (
                            <div style={{ fontSize: 11, color: isOver ? stage.color : 'var(--text3)', textAlign: 'center', padding: '20px 0', opacity: 0.7 }}>
                              {isOver ? 'Drop here' : 'Empty'}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Lead Detail Slide-Out */}
      {detailLead && (
        <LeadDetailPanel
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          showToast={showToast}
          onLeadUpdated={(updated) => {
            setLeads(ls => ls.map(l => l.id === updated.id ? { ...l, ...updated } : l));
            setDetailLead(updated);
          }}
        />
      )}
    </Layout>
  );
}
