import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';

export default function ConversationNotes({ leadId }) {
  const { addToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get(`/engagement/${leadId}/notes`)
      .then(r => { setNotes(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [leadId]);

  const save = async () => {
    if (!input.trim() || saving) return;
    setSaving(true);
    try {
      await api.post(`/engagement/${leadId}/notes`, { content: input.trim() });
      setInput('');
      load();
    } catch (e) { addToast('Failed to save note', 'error'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/engagement/notes/${id}`);
      setNotes(n => n.filter(x => x.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      addToast('Failed to delete note — please try again', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Log a conversation note — what did they say? next step? objection?"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
          style={{ flex: 1, minHeight: 70, fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
        />
        <button onClick={save} disabled={!input.trim() || saving}
          style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, alignSelf: 'flex-end' }}>
          {saving ? '...' : '+ Log'}
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>Cmd+Enter to save quickly</div>
      {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div> : notes.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>No notes yet. Log your first conversation.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.content}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {n.user_name} · {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <button onClick={() => del(n.id)} style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
