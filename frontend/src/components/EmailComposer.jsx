import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';

const TOOLBAR_BTNS = [
  { cmd: 'bold', icon: 'B', style: { fontWeight: 700 } },
  { cmd: 'italic', icon: 'I', style: { fontStyle: 'italic' } },
  { cmd: 'underline', icon: 'U', style: { textDecoration: 'underline' } },
];

export default function EmailComposer({ isOpen, onClose, lead, touchpoint }) {
  const { showToast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [signature, setSignature] = useState('');
  const [sending, setSending] = useState(false);
  const [visible, setVisible] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTo(lead?.email || '');
      setSubject(lead?.company ? `Following up — ${lead.company}` : 'Following up');
      // Load signature from company profile
      api.get('/company-profile').then(r => {
        const cp = r.data;
        if (cp?.company_name) {
          setSignature(`Best regards,\n${cp.contact_name || ''}\n${cp.company_name}\n${cp.contact_email || ''}`);
        }
      }).catch(() => {});
      // Load draft if exists
      if (lead?.id) {
        try {
          const draft = JSON.parse(localStorage.getItem(`sumx_email_draft_${lead.id}`));
          if (draft) {
            setTo(draft.to || lead?.email || '');
            setSubject(draft.subject || '');
            setTimeout(() => { if (bodyRef.current) bodyRef.current.innerHTML = draft.body || ''; }, 100);
          }
        } catch {}
      }
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen, lead?.id]);

  if (!isOpen) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
    bodyRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) document.execCommand('createLink', false, url);
    bodyRef.current?.focus();
  };

  const handleSend = async () => {
    if (!to.trim()) { showToast('Please enter a recipient email', 'error'); return; }
    setSending(true);
    try {
      // Log as a touch completion if we have a lead and touchpoint
      if (lead?.id && touchpoint) {
        await api.post(`/sequence/${lead.id}/touch`, {
          touchpoint: touchpoint,
          status: 'done',
          notes: `Email sent: ${subject}`,
        });
      }
      // Clear draft
      if (lead?.id) localStorage.removeItem(`sumx_email_draft_${lead.id}`);
      showToast('Email sent and logged as completed touch', 'success');
      handleClose();
    } catch {
      showToast('Failed to log email', 'error');
    } finally { setSending(false); }
  };

  const saveDraft = () => {
    if (!lead?.id) return;
    const draft = {
      to,
      subject,
      body: bodyRef.current?.innerHTML || '',
    };
    localStorage.setItem(`sumx_email_draft_${lead.id}`, JSON.stringify(draft));
    showToast('Draft saved', 'success');
  };

  const inputStyle = { width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' };

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s',
      }} />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.95)',
        opacity: visible ? 1 : 0, transition: 'all 0.2s ease',
        width: '100%', maxWidth: 640, maxHeight: '85vh',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)', zIndex: 301,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>✉ Compose Email</div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* To */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>To</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@email.com" style={inputStyle} />
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" style={inputStyle} />
          </div>

          {/* Rich Text Toolbar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 4, padding: '4px 0' }}>
            {TOOLBAR_BTNS.map(btn => (
              <button key={btn.cmd} onClick={() => execCmd(btn.cmd)}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', ...btn.style }}>
                {btn.icon}
              </button>
            ))}
            <button onClick={insertLink}
              style={{ height: 28, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--accent2)', cursor: 'pointer' }}>
              🔗 Link
            </button>
          </div>

          {/* Body (contentEditable) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Body</label>
            <div ref={bodyRef} contentEditable suppressContentEditableWarning
              style={{
                minHeight: 180, padding: '10px 12px', fontSize: 13, lineHeight: 1.7,
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', outline: 'none', overflowY: 'auto',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Signature */}
          {signature && (
            <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
              {signature}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={handleClose}
            style={{ padding: '9px 18px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={saveDraft}
            style={{ padding: '9px 18px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', fontWeight: 500 }}>
            Save Draft
          </button>
          <button onClick={handleSend} disabled={sending}
            style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}
