import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import SequenceTracker from './SequenceTracker';
import LeadNotes from './LeadNotes';
import Battlecard from './Battlecard';
import CallLogger from './CallLogger';
import ConversationNotes from './ConversationNotes';

const tabs = [
  { key: 'lead_info', label: '👤 Lead Info' },
  { key: 'conversation', label: '💬 Conversation' },
  { key: 'sequence', label: '📋 Sequence' },
  { key: 'research', label: 'Research' },
  { key: 'email1', label: 'Email 1' },
  { key: 'email2', label: 'Email 2' },
  { key: 'email3', label: 'Email 3' },
  { key: 'email4', label: 'Email 4' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'call_opener', label: 'Call Opener' },
  { key: 'objection_handling', label: 'Objections' },
  { key: 'notes', label: '📝 Notes' },
  { key: 'chat', label: '🤖 AI Coach' },
];

const EMAIL_KEYS = ['email1', 'email2', 'email3', 'email4'];
const SPECIAL_TABS = ['lead_info', 'conversation', 'sequence', 'notes', 'chat'];
const CHAT_HINTS = [
  'Rewrite email 1 — shorter, punchier',
  'Tighten the call opener to 12 seconds',
  'Give me 3 more objection rebuttals',
  'Rewrite email 2 from a different angle',
  'What should I know walking into this call?',
  'Write a LinkedIn DM for after they accept',
  'What are the landmines to avoid with this title?',
];

const s = {
  wrap: { marginTop: 16 },
  tabs: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '1rem' },
  tab: (active) => ({
    padding: '6px 13px', fontSize: 12, fontWeight: 500, borderRadius: 20,
    background: active ? 'var(--accent)' : 'var(--bg3)',
    color: active ? '#fff' : 'var(--text2)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    cursor: 'pointer', transition: 'all 0.15s',
  }),
  content: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', position: 'relative' },
  pre: { whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', wordBreak: 'break-word' },
  actionRow: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  btn: (variant) => ({
    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer',
    background: variant === 'copy' ? 'var(--bg3)' : variant === 'send' ? 'var(--success-bg)' : variant === 'saved' ? 'var(--success-bg)' : 'var(--bg3)',
    color: variant === 'copy' ? 'var(--text2)' : variant === 'send' ? 'var(--success)' : variant === 'saved' ? 'var(--success)' : 'var(--text3)',
    border: variant === 'copy' ? '1px solid var(--border)' : variant === 'send' ? '1px solid var(--success)' : variant === 'saved' ? '1px solid var(--success)' : '1px solid var(--border)',
  }),
  genTime: { fontSize: 11, color: 'var(--text3)', marginTop: 10, textAlign: 'right' },
  chatWrap: { display: 'flex', flexDirection: 'column', height: 420 },
  chatMessages: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, paddingRight: 4 },
  chatInput: { display: 'flex', gap: 8 },
  chatTextarea: { flex: 1, minHeight: 44, maxHeight: 120, resize: 'vertical', fontSize: 13, padding: '10px 12px' },
  sendChatBtn: { padding: '10px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, alignSelf: 'flex-end', border: 'none', cursor: 'pointer' },
  chatHints: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  hint: { fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  infoField: { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  infoValue: { fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' },
  infoLink: { fontSize: 13, color: 'var(--accent2)', textDecoration: 'none', wordBreak: 'break-word' },
  editInput: { fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: '100%' },
  editTextarea: { fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: '100%', resize: 'vertical', minHeight: 70 },
};

const msgStyle = (role) => ({
  padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: 13, lineHeight: 1.6,
  maxWidth: '85%', whiteSpace: 'pre-wrap', alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
  background: role === 'user' ? 'var(--accent)' : 'var(--bg3)',
  color: role === 'user' ? '#fff' : 'var(--text)',
  border: role === 'user' ? 'none' : '1px solid var(--border)',
});

export default function PlaybookViewer({ playbook, leadId, lead: leadProp, onPlaybookUpdate }) {
  const [activeTab, setActiveTab] = useState('sequence');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false); // kept for future use
  const [sent, setSent] = useState({});
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [localLead, setLocalLead] = useState(leadProp || {});
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  const [generatingTab, setGeneratingTab] = useState(false);
  const [localPlaybook, setLocalPlaybook] = useState(playbook || {});
  const [engagementStatus, setEngagementStatus] = useState(leadProp?.engagement_status || 'active');
  const [snoozedUntil, setSnoozedUntil] = useState(leadProp?.snoozed_until || null);
  const [showSnooze, setShowSnooze] = useState(false);
  const chatBottomRef = useRef(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (leadProp) setLocalLead(leadProp);
  }, [leadProp]);

  useEffect(() => {
    if (playbook) setLocalPlaybook(playbook);
  }, [playbook]);

  // Reset edit state when switching tabs
  useEffect(() => {
    setEditingContent(false);
    setContentDraft('');
    setCopied(false);
    setSending(false);
    setGeneratingTab(false);
  }, [activeTab]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages]);

  const exportLead = (format) => {
    const token = localStorage.getItem('pf_token');
    window.open(`/api/export/lead/${leadId}/${format}?token=${token}`, '_blank');
  };

  const copy = () => {
    navigator.clipboard.writeText(playbook?.[activeTab] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openInZoho = null; // removed - use → Zoho button in lead list to push contact

  const saveAsTemplate = async (tabKey) => {
    const emailText = playbook?.[tabKey];
    if (!emailText) return;
    const name = prompt('Template name (e.g. "Day 1 - CFO outreach"):');
    if (!name) return;
    const lines = emailText.split('\n');
    const subjectLine = lines.find(l => l.toUpperCase().startsWith('SUBJECT:'));
    const subject = subjectLine ? subjectLine.replace(/^SUBJECT:\s*/i, '').trim() : '';
    const body = lines.filter(l => !l.toUpperCase().startsWith('SUBJECT:')).join('\n').trim();
    try {
      await api.post('/templates', { name, subject, body, touchpoint: tabKey });
      setSavedTemplate(true);
      setTimeout(() => setSavedTemplate(false), 2500);
    } catch (err) { alert('Failed to save template'); }
  };

  const sendChat = async (text) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const r = await api.post(`/chat/${leadId}`, { messages: newMessages });
      setChatMessages([...newMessages, { role: 'assistant', content: r.data.reply }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Error: ' + (err.response?.data?.error || err.message) }]);
    } finally { setChatLoading(false); }
  };

  const saveContent = async (e) => {
    if (cancelEditRef.current) { cancelEditRef.current = false; return; }
    if (savingContent) return;
    setSavingContent(true);
    try {
      await api.put(`/playbooks/${leadId}/field`, { field: activeTab, value: contentDraft });
      setLocalPlaybook(p => ({ ...p, [activeTab]: contentDraft }));
      setEditingContent(false);
    } catch (err) {
      alert('Failed to save');
    } finally { setSavingContent(false); }
  };

  const cancelContent = () => {
    cancelEditRef.current = true;
    setEditingContent(false);
    setContentDraft('');
  };

  const setEngagement = async (status) => {
    try {
      await api.post(`/engagement/${leadId}/status`, { status });
      setEngagementStatus(status);
    } catch (e) { alert('Failed to update status'); }
  };

  const snooze = async (days) => {
    try {
      const r = await api.post(`/engagement/${leadId}/snooze`, { days });
      setSnoozedUntil(r.data.snoozed_until);
      setShowSnooze(false);
    } catch (e) { alert('Failed to snooze'); }
  };

  const generateTab = async () => {
    setGeneratingTab(true);
    try {
      const r = await api.post(`/playbooks/generate/${leadId}`, { sections: { [activeTab]: true } });
      if (r.data[activeTab]) {
        setLocalPlaybook(p => ({ ...p, [activeTab]: r.data[activeTab] }));
      }
    } catch (err) {
      alert('Generation failed');
    } finally { setGeneratingTab(false); }
  };

  const startEditContent = () => {
    setContentDraft(localPlaybook[activeTab] || '');
    setEditingContent(true);
  };

  const startEditInfo = () => {
    setInfoForm({
      full_name: localLead.full_name || '',
      company: localLead.company || '',
      title: localLead.title || '',
      email: localLead.email || '',
      phone: localLead.phone || '',
      linkedin: localLead.linkedin || '',
      notes: localLead.notes || '',
    });
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      // Get list_id from lead
      const listId = localLead.list_id;
      if (listId) {
        await api.put(`/lists/${listId}/leads/${leadId}`, infoForm);
      }
      setLocalLead(prev => ({ ...prev, ...infoForm }));
      setEditingInfo(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally { setSavingInfo(false); }
  };

  if (!playbook) return null;

  const isEmailTab = EMAIL_KEYS.includes(activeTab);
  const displayLead = localLead;

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lead Info Tab */}
      {activeTab === 'lead_info' && (
        <div style={s.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Lead Details</div>
            {!editingInfo ? (
              <button style={{ ...s.btn('copy'), padding: '5px 12px', fontSize: 12 }} onClick={startEditInfo}>✏️ Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.btn('saved'), padding: '5px 12px', fontSize: 12 }} onClick={saveInfo} disabled={savingInfo}>
                  {savingInfo ? 'Saving...' : '✓ Save'}
                </button>
                <button style={{ ...s.btn('copy'), padding: '5px 12px', fontSize: 12 }} onClick={() => setEditingInfo(false)}>Cancel</button>
              </div>
            )}
          </div>
          {!editingInfo ? (
            <div>
            <div style={s.infoGrid}>
              {[
                { label: 'Full Name', value: displayLead.full_name },
                { label: 'Company', value: displayLead.company },
                { label: 'Title', value: displayLead.title },
                { label: 'Email', value: displayLead.email, isEmail: true },
                { label: 'Phone', value: displayLead.phone },
                { label: 'LinkedIn', value: displayLead.linkedin, isLink: true },
              ].map(f => (
                <div key={f.label} style={s.infoField}>
                  <div style={s.infoLabel}>{f.label}</div>
                  {f.isEmail && f.value ? (
                    <a href={`mailto:${f.value}`} style={s.infoLink}>{f.value}</a>
                  ) : f.isLink && f.value ? (
                    <a href={f.value} target="_blank" rel="noreferrer" style={s.infoLink}>{f.value}</a>
                  ) : (
                    <div style={{ ...s.infoValue, color: f.value ? 'var(--text)' : 'var(--text3)' }}>{f.value || '—'}</div>
                  )}
                </div>
              ))}
              <div style={{ ...s.infoField, gridColumn: '1 / -1' }}>
                <div style={s.infoLabel}>Notes</div>
                <div style={{ ...s.infoValue, color: displayLead.notes ? 'var(--text)' : 'var(--text3)', whiteSpace: 'pre-wrap' }}>{displayLead.notes || '—'}</div>
              </div>
              {displayLead.icp_score != null && (
                <div style={{ ...s.infoField, gridColumn: '1 / -1' }}>
                  <div style={s.infoLabel}>ICP Analysis</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)' }}>
                    <strong>Score: {displayLead.icp_score}</strong>{displayLead.icp_reason ? ` — ${displayLead.icp_reason}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Engagement Status */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ ...s.infoLabel, marginBottom: 8 }}>Engagement Status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'active', label: '🔵 Active', color: 'var(--accent)' },
                  { key: 'responded', label: '💬 Responded', color: '#0077b5' },
                  { key: 'meeting_booked', label: '🗓 Meeting Booked', color: 'var(--success)' },
                  { key: 'nurture', label: '🌱 Nurture', color: '#f59e0b' },
                  { key: 'not_interested', label: '🚫 Not Interested', color: 'var(--danger)' },
                ].map(st => (
                  <button key={st.key} onClick={() => setEngagement(st.key)}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontWeight: engagementStatus === st.key ? 600 : 400,
                      background: engagementStatus === st.key ? st.color : 'var(--bg3)',
                      color: engagementStatus === st.key ? '#fff' : 'var(--text2)',
                      border: `1px solid ${engagementStatus === st.key ? st.color : 'var(--border)'}` }}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Snooze */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {snoozedUntil && new Date(snoozedUntil) > new Date() ? (
                  <div style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 20, padding: '3px 10px' }}>
                    😴 Snoozed until {new Date(snoozedUntil).toLocaleDateString()}
                    <button onClick={async () => { await api.delete(`/engagement/${leadId}/snooze`); setSnoozedUntil(null); }}
                      style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontSize: 11 }}>✕ Unsnooze</button>
                  </div>
                ) : (
                  <button onClick={() => setShowSnooze(v => !v)}
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                    😴 Snooze
                  </button>
                )}
              </div>
              {showSnooze && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: '2 days', days: 2 }, { label: '1 week', days: 7 },
                    { label: '2 weeks', days: 14 }, { label: '1 month', days: 30 },
                  ].map(opt => (
                    <button key={opt.days} onClick={() => snooze(opt.days)}
                      style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { key: 'full_name', label: 'Full Name', placeholder: 'Sarah Chen' },
                  { key: 'company', label: 'Company', placeholder: 'Apex Federal' },
                  { key: 'title', label: 'Title', placeholder: 'VP of Business Development' },
                  { key: 'email', label: 'Email', placeholder: 's.chen@apex.com' },
                  { key: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000' },
                  { key: 'linkedin', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={s.infoLabel}>{f.label}</label>
                    <input style={s.editInput} value={infoForm[f.key] || ''} placeholder={f.placeholder}
                      onChange={e => setInfoForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={s.infoLabel}>Notes</label>
                <textarea style={s.editTextarea} value={infoForm.notes || ''} placeholder="Notes about this lead..."
                  onChange={e => setInfoForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special tabs with their own components */}
      {activeTab === 'sequence' && (
        <div style={s.content}><SequenceTracker leadId={leadId} /></div>
      )}
      {activeTab === 'conversation' && (
        <div style={s.content}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Conversation Log</div>
          <ConversationNotes leadId={leadId} />
        </div>
      )}
      {activeTab === 'notes' && (
        <div style={s.content}><LeadNotes leadId={leadId} /></div>
      )}

      {/* AI Coach */}
      {activeTab === 'chat' && (
        <div style={s.content}>
          <div style={s.chatWrap}>
            <div style={s.chatMessages}>
              {chatMessages.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '0.5rem 0' }}>
                  Ask your AI sales coach anything about this prospect or playbook.
                </div>
              )}
              {chatMessages.map((m, i) => <div key={i} style={msgStyle(m.role)}>{m.content}</div>)}
              {chatLoading && <div style={{ ...msgStyle('assistant'), opacity: 0.6 }}>Thinking...</div>}
              <div ref={chatBottomRef} />
            </div>
            <div style={s.chatHints}>
              {CHAT_HINTS.map(h => <span key={h} style={s.hint} onClick={() => sendChat(h)}>{h}</span>)}
            </div>
            <div style={s.chatInput}>
              <textarea style={s.chatTextarea} value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Rewrite an email, get objection rebuttals, ask about the prospect..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button style={s.sendChatBtn} onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Text content tabs */}
      {!SPECIAL_TABS.includes(activeTab) && (
        <div style={s.content}>
          <div style={s.actionRow}>
            {!editingContent ? (
              <>
                <button style={s.btn('copy')} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
                <button style={{ ...s.btn('copy'), background: generatingTab ? 'var(--bg3)' : 'var(--accent-bg)', color: generatingTab ? 'var(--text3)' : 'var(--accent2)', border: '1px solid var(--accent)' }} onClick={generateTab} disabled={generatingTab}>
                  {generatingTab ? '⚡ Generating...' : '⚡ Regenerate'}
                </button>
                <button style={s.btn('copy')} onClick={() => exportLead('html')}>⬇ Export PDF</button>
                <button style={s.btn('copy')} onClick={() => exportLead('csv')}>⬇ Export CSV</button>
                {isEmailTab && (
                  <button style={s.btn(savedTemplate ? 'saved' : 'template')} onClick={() => saveAsTemplate(activeTab)}>
                    {savedTemplate ? '✓ Saved as template' : '⊕ Save as template'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button style={s.btn('send')} onClick={saveContent} disabled={savingContent}>{savingContent ? 'Saving...' : '✓ Save'}</button>
                <button style={s.btn('copy')} onMouseDown={() => { cancelEditRef.current = true; }} onClick={cancelContent}>Cancel</button>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Click outside to save</span>
              </>
            )}
          </div>
          {editingContent ? (
            <textarea
              autoFocus
              value={contentDraft}
              onChange={e => setContentDraft(e.target.value)}
              onBlur={saveContent}
              style={{ width: '100%', minHeight: 320, fontFamily: 'Inter, sans-serif', fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '1rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            <pre
              style={{ ...s.pre, cursor: 'text', borderRadius: 'var(--radius)', padding: '0.5rem', margin: '-0.5rem', transition: 'background 0.1s' }}
              onClick={startEditContent}
              title="Click to edit"
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >{localPlaybook[activeTab] || <span style={{ color: 'var(--text3)' }}>Click ⚡ Regenerate to generate this section.</span>}</pre>
          )}
          {localPlaybook.generated_at && !editingContent && (
            <div style={s.genTime}>Generated {new Date(localPlaybook.generated_at).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  );
}


