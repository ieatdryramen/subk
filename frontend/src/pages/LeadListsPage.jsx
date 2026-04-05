import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  newBtn: { padding: '9px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500 },
  grid: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: 500, marginBottom: 3 },
  cardMeta: { fontSize: 12, color: 'var(--text2)' },
  cardRight: { display: 'flex', gap: 8, alignItems: 'center' },
  openBtn: { padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 13, borderRadius: 'var(--radius)' },
  delBtn: { padding: '7px 10px', background: 'transparent', border: '1px solid transparent', color: 'var(--text3)', fontSize: 13, borderRadius: 'var(--radius)' },
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 17, fontWeight: 600, marginBottom: '1.25rem' },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 },
  modalBtns: { display: 'flex', gap: 8, marginTop: '1.25rem' },
  cancelBtn: { flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)' },
  createBtn: { flex: 1, padding: 10, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500 },
  countBadge: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: 'var(--text2)' },
};

export default function LeadListsPage() {
  const [lists, setLists] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [loadError, setLoadError] = useState(null);
  const load = () => {
    setLoadError(null);
    api.get('/lists').then(r => setLists(r.data)).catch(err => { console.error(err); setLoadError('Failed to load lists'); });
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const r = await api.post('/lists', form);
      setShowModal(false);
      setForm({ name: '', description: '' });
      navigate(`/lists/${r.data.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteList = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this list and all its leads?')) return;
    try {
      await api.delete(`/lists/${id}`);
      load();
    } catch (err) {
      console.error(err);
      alert('Failed to delete list — try again');
    }
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Lead Lists</div>
        <div style={s.sub}>Organize your prospects into lists — import via CSV or add manually, then generate playbooks for everyone.</div>

        <div style={s.topBar}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{lists.length} list{lists.length !== 1 ? 's' : ''}</span>
          <button style={s.newBtn} onClick={() => setShowModal(true)}>+ New List</button>
        </div>

        {loadError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{loadError}</div>
            <button onClick={load} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
          </div>
        ) : lists.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>◉</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No lists yet</div>
            <div style={{ fontSize: 13 }}>Create your first lead list to get started</div>
          </div>
        ) : (
          <div style={s.grid}>
            {lists.map(list => (
              <div key={list.id} style={s.card}
                onClick={() => navigate(`/lists/${list.id}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={s.cardLeft}>
                  <div style={s.cardName}>{list.name}</div>
                  <div style={s.cardMeta}>
                    {list.description || 'No description'} · Created {new Date(list.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={s.cardRight}>
                  <span style={s.countBadge}>{list.lead_count} lead{Number(list.lead_count) !== 1 ? 's' : ''}</span>
                  <button style={s.openBtn}>Open →</button>
                  <button style={s.delBtn} onClick={e => deleteList(e, list.id)} title="Delete list">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Create new list</div>
            <div style={s.field}>
              <label style={s.label}>List name</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Q2 GovCon Targets" onKeyDown={e => e.key === 'Enter' && create()} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Description (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Prime contractors in VA/NC corridor" />
            </div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.createBtn} onClick={create} disabled={loading || !form.name.trim()}>
                {loading ? 'Creating...' : 'Create list'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
