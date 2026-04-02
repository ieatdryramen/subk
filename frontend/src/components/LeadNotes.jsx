import { useState, useEffect } from 'react';
import api from '../lib/api';

const s = {
  wrap: { padding: '4px 0' },
  noteInput: { width: '100%', marginBottom: 8 },
  addBtn: { padding: '7px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' },
  notesList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  note: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' },
  noteContent: { fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: 6, whiteSpace: 'pre-wrap' },
  noteMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  noteAuthor: { fontSize: 11, color: 'var(--text3)' },
  deleteBtn: { fontSize: 11, color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  empty: { fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', padding: '0.5rem 0' },
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

export default function LeadNotes({ leadId }) {
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get(`/notes/${leadId}`).then(r => setNotes(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [leadId]);

  const add = async () => {
    if (!input.trim()) return;
    setSaving(true);
    try {
      await api.post(`/notes/${leadId}`, { content: input.trim() });
      setInput('');
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const del = async (noteId) => {
    await api.delete(`/notes/${leadId}/${noteId}`);
    setNotes(n => n.filter(note => note.id !== noteId));
  };

  return (
    <div style={s.wrap}>
      <textarea
        style={s.noteInput}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Add a note — call outcome, email reply, anything relevant..."
        rows={3}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) add(); }}
      />
      <button style={s.addBtn} onClick={add} disabled={saving || !input.trim()}>
        {saving ? 'Saving...' : 'Add note'}
      </button>
      <div style={s.notesList}>
        {notes.length === 0 && <div style={s.empty}>No notes yet</div>}
        {notes.map(note => (
          <div key={note.id} style={s.note}>
            <div style={s.noteContent}>{note.content}</div>
            <div style={s.noteMeta}>
              <span style={s.noteAuthor}>{note.author || 'You'} · {timeAgo(note.created_at)}</span>
              <button style={s.deleteBtn} onClick={() => del(note.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
