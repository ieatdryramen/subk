import { useState, useEffect } from 'react';
import api from '../lib/api';

// Utility: format relative time
const timeAgo = (ts) => {
  if (!ts) return 'unknown';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

// Utility: calculate days in pipeline
const daysSinceDateString = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - d);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Map touchpoint to icon
const getTouchIcon = (touchpoint) => {
  if (!touchpoint) return '📝';
  if (touchpoint.includes('email')) return '📧';
  if (touchpoint.includes('call')) return '📞';
  if (touchpoint.includes('linkedin')) return '💼';
  if (touchpoint.includes('meeting')) return '🤝';
  return '📝';
};

// Map note_type to badge
const getNoteTypeBadge = (noteType) => {
  const types = {
    general: { label: 'Note', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    call_outcome: { label: 'Call', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    email_note: { label: 'Email', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    meeting_note: { label: 'Meeting', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    objection: { label: 'Objection', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  };
  return types[noteType] || types.general;
};

export default function LeadDetailDrawer({ lead, isOpen, onClose, showToast, onLeadUpdated }) {
  const [currentTab, setCurrentTab] = useState('overview');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteSaving, setNoteSaving] = useState(false);

  // Animate in when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentTab('overview');
      requestAnimationFrame(() => setDrawerVisible(true));
    }
  }, [isOpen]);

  // Escape key closes drawer
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Load notes when drawer opens
  useEffect(() => {
    if (isOpen && lead?.id) {
      loadNotes();
    }
  }, [isOpen, lead?.id]);

  // Load timeline when timeline tab is clicked
  useEffect(() => {
    if (currentTab === 'timeline' && lead?.id && timeline.length === 0) {
      loadTimeline();
    }
  }, [currentTab, lead?.id]);

  const handleClose = () => {
    setDrawerVisible(false);
    setTimeout(onClose, 250);
  };

  const loadNotes = async () => {
    if (!lead?.id) return;
    setNotesLoading(true);
    try {
      const res = await api.get(`/notes/lead/${lead.id}`);
      setNotes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const loadTimeline = async () => {
    if (!lead?.id) return;
    setTimelineLoading(true);
    try {
      const res = await api.get(`/notes/lead/${lead.id}/timeline`);
      setTimeline(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !lead?.id) return;
    setNoteSaving(true);
    try {
      const res = await api.post(`/notes/lead/${lead.id}`, {
        content: noteContent.trim(),
        note_type: noteType,
      });
      setNotes((prev) => [res.data, ...prev]);
      setNoteContent('');
      setNoteType('general');
      showToast('Note saved', 'success');
    } catch (err) {
      console.error('Failed to save note:', err);
      showToast('Failed to save note', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  if (!isOpen || !lead) return null;

  const icpColor = lead.icp_score >= 75 ? '#14b8a6' : lead.icp_score >= 40 ? '#f59e0b' : '#6b7280';
  const icpBg = lead.icp_score >= 75 ? 'rgba(20,184,166,0.15)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)';

  const tabStyles = {
    tab: (isActive) => ({
      padding: '10px 16px',
      fontSize: 13,
      fontWeight: 500,
      background: 'none',
      border: 'none',
      borderBottom: isActive ? '2px solid #14b8a6' : '2px solid transparent',
      color: isActive ? '#14b8a6' : 'var(--text2)',
      cursor: 'pointer',
      transition: 'color 0.2s, border-color 0.2s',
    }),
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 300,
          opacity: drawerVisible ? 1 : 0,
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 560,
          height: '100vh',
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--border)',
          zIndex: 301,
          overflowY: 'auto',
          transform: drawerVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header - Sticky */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg2)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{lead.full_name || lead.email || 'Unknown'}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                {lead.title}{lead.title && lead.company ? ' at ' : ''}{lead.company}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lead.icp_score != null && (
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: icpBg,
                      color: icpColor,
                    }}
                  >
                    ICP {lead.icp_score}
                  </div>
                )}
                {lead.sequence_stage && (
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      background: 'var(--bg3)',
                      color: 'var(--text2)',
                    }}
                  >
                    {lead.sequence_stage}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 18,
                color: 'var(--text3)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Days in Pipeline</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{daysSinceDateString(lead.created_at)} days</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Last Touched</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{timeAgo(lead.updated_at)}</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {lead.status === 'done' ? '✓ Done' : lead.status || 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
            position: 'sticky',
            top: 'auto',
            zIndex: 9,
          }}
        >
          <button style={tabStyles.tab(currentTab === 'overview')} onClick={() => setCurrentTab('overview')}>
            Overview
          </button>
          <button style={tabStyles.tab(currentTab === 'timeline')} onClick={() => setCurrentTab('timeline')}>
            Timeline
          </button>
          <button style={tabStyles.tab(currentTab === 'notes')} onClick={() => setCurrentTab('notes')}>
            Notes
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* OVERVIEW TAB */}
          {currentTab === 'overview' && (
            <div>
              {/* Contact Info */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Contact Info
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>📧</span>
                      <a href={`mailto:${lead.email}`} style={{ color: '#14b8a6', textDecoration: 'none' }}>
                        {lead.email}
                      </a>
                    </div>
                  )}
                  {lead.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>📞</span>
                      <a href={`tel:${lead.phone}`} style={{ color: '#14b8a6', textDecoration: 'none' }}>
                        {lead.phone}
                      </a>
                    </div>
                  )}
                  {lead.linkedin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>💼</span>
                      <a href={lead.linkedin} target="_blank" rel="noreferrer" style={{ color: '#14b8a6', textDecoration: 'none' }}>
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {!lead.email && !lead.phone && !lead.linkedin && (
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No contact info available</div>
                  )}
                </div>
              </div>

              {/* Company Details */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Company Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.company && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>🏢</span>
                      <span>{lead.company}</span>
                    </div>
                  )}
                  {lead.title && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 16 }}>💼</span>
                      <span>{lead.title}</span>
                    </div>
                  )}
                  {!lead.company && !lead.title && (
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No company details</div>
                  )}
                </div>
              </div>

              {/* Lead Details */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Lead Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text2)' }}>Status:</span>
                    <span style={{ fontWeight: 500 }}>{lead.status || 'pending'}</span>
                  </div>
                  {lead.icp_score != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text2)' }}>ICP Score:</span>
                      <span style={{ fontWeight: 500, color: icpColor }}>{lead.icp_score}</span>
                    </div>
                  )}
                  {lead.icp_reason && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text2)' }}>ICP Reason:</span>
                      <span style={{ fontWeight: 500, maxWidth: '60%', textAlign: 'right' }}>{lead.icp_reason}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TIMELINE TAB */}
          {currentTab === 'timeline' && (
            <div>
              {timelineLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Loading timeline...</div>
              ) : timeline.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>No activity yet</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  {/* Vertical timeline line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: 'var(--border)',
                    }}
                  />

                  {timeline.map((item, idx) => {
                    const icon = item.type === 'note' ? '📝' : getTouchIcon(item.touchpoint);
                    const typeBadge = item.type === 'note' ? getNoteTypeBadge(item.note_type) : null;

                    return (
                      <div key={idx} style={{ marginBottom: 20, position: 'relative' }}>
                        {/* Timeline dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: -18,
                            top: 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'var(--bg2)',
                            border: '2px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8,
                          }}
                        >
                          {icon}
                        </div>

                        {/* Content */}
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                            {typeBadge && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: typeBadge.bg,
                                  color: typeBadge.color,
                                }}
                              >
                                {typeBadge.label}
                              </span>
                            )}
                            {item.type === 'touch' && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: 'rgba(59,130,246,0.15)',
                                  color: '#3b82f6',
                                }}
                              >
                                {item.touchpoint}
                              </span>
                            )}
                            {item.status && (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                                {item.status === 'done' ? '✓' : '○'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {item.content || item.notes || '(No content)'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {item.user_name} · {timeAgo(item.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {currentTab === 'notes' && (
            <div>
              {/* Add Note Form */}
              <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                    Note Type
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg2)',
                      color: 'var(--text)',
                    }}
                  >
                    <option value="general">General Note</option>
                    <option value="call_outcome">Call Outcome</option>
                    <option value="email_note">Email Note</option>
                    <option value="meeting_note">Meeting Note</option>
                    <option value="objection">Objection</option>
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                    Note
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add a note about this lead..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg2)',
                      color: 'var(--text)',
                      resize: 'vertical',
                      minHeight: 70,
                    }}
                  />
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={noteSaving || !noteContent.trim()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    background: '#14b8a6',
                    color: '#fff',
                    cursor: noteSaving || !noteContent.trim() ? 'not-allowed' : 'pointer',
                    opacity: noteSaving || !noteContent.trim() ? 0.6 : 1,
                  }}
                >
                  {noteSaving ? 'Saving...' : 'Save Note'}
                </button>
              </div>

              {/* Notes List */}
              {notesLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Loading notes...</div>
              ) : notes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>No notes yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notes.map((note) => {
                    const badge = getNoteTypeBadge(note.note_type);
                    return (
                      <div
                        key={note.id}
                        style={{
                          padding: 12,
                          background: 'var(--bg)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {note.content}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {note.user_name || 'Unknown'} · {timeAgo(note.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
