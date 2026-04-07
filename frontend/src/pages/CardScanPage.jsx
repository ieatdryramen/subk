import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  uploadZone: { border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '1.5rem', background: 'var(--bg2)' },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadText: { fontSize: 15, fontWeight: 500, marginBottom: 6 },
  uploadSub: { fontSize: 13, color: 'var(--text2)' },
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  addBtn: { width: '100%', padding: '11px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btn: (v) => ({ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: v === 'primary' ? 'none' : '1px solid var(--border)', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? 'var(--danger-bg)' : 'var(--bg3)', color: v === 'primary' ? '#fff' : v === 'danger' ? 'var(--danger)' : 'var(--text2)' }),
  statusBadge: (s) => ({ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: s === 'done' ? 'var(--success-bg)' : s === 'error' ? 'var(--danger-bg)' : s === 'scanning' ? 'var(--warning-bg)' : s === 'added' ? 'var(--accent-bg)' : 'var(--bg3)', color: s === 'done' ? 'var(--success)' : s === 'error' ? 'var(--danger)' : s === 'scanning' ? 'var(--warning)' : s === 'added' ? 'var(--accent2)' : 'var(--text3)' }),
};

const EMPTY_RESULT = { name: '', company: '', title: '', email: '', phone: '', linkedin: '' };

export default function CardScanPage() {
  const [queue, setQueue] = useState([]); // [{ id, preview, imageData, status, result, error }]
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName] = useState('');
  const [scanningAll, setScanningAll] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/lists').then(r => {
      setLists(r.data);
      if (r.data.length) setSelectedList(String(r.data[0].id));
    });
  }, []);

  const addFiles = (files) => {
    const imageFiles = [...files].filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const newItems = imageFiles.map((file, i) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          id: Date.now() + i,
          preview: e.target.result,
          imageData: e.target.result.split(',')[1],
          status: 'pending', // pending | scanning | done | error | added
          result: null,
          error: null,
          editing: false,
        });
        reader.readAsDataURL(file);
      });
    });
    Promise.all(newItems).then(items => {
      setQueue(q => [...q, ...items]);
    });
  };

  const scanOne = async (id) => {
    setQueue(q => q.map(c => c.id === id ? { ...c, status: 'scanning', error: null } : c));
    try {
      const card = queue.find(c => c.id === id);
      const r = await api.post('/cardscan/scan', { imageData: card.imageData });
      setQueue(q => q.map(c => c.id === id ? { ...c, status: 'done', result: { ...EMPTY_RESULT, ...r.data } } : c));
    } catch (err) {
      setQueue(q => q.map(c => c.id === id ? { ...c, status: 'error', error: err.response?.data?.error || 'Scan failed' } : c));
    }
  };

  const scanAll = async () => {
    setScanningAll(true);
    const pending = queue.filter(c => c.status === 'pending' || c.status === 'error');
    for (const card of pending) {
      await scanOne(card.id);
    }
    setScanningAll(false);
  };

  const updateResult = (id, field, value) => {
    setQueue(q => q.map(c => c.id === id ? { ...c, result: { ...c.result, [field]: value } } : c));
  };

  const removeCard = (id) => {
    setQueue(q => q.filter(c => c.id !== id));
  };

  const addOne = async (id) => {
    const card = queue.find(c => c.id === id);
    if (!card?.result) return;
    let listId = selectedList;
    if (!listId && newListName) {
      const r = await api.post('/lists', { name: newListName });
      listId = String(r.data.id);
      setLists(l => [...l, r.data]);
      setSelectedList(listId);
    }
    if (!listId) { showToast('Select or create a list first', 'error'); return; }
    try {
      await api.post(`/lists/${listId}/leads`, { leads: [{ full_name: card.result.name, company: card.result.company, title: card.result.title, email: card.result.email, phone: card.result.phone, linkedin: card.result.linkedin, notes: 'Scanned business card' }] });
      setQueue(q => q.map(c => c.id === id ? { ...c, status: 'added' } : c));
      showToast('Lead added successfully', 'success');
      // Auto-generate in background
      api.get(`/lists/${listId}/leads`).then(r => {
        const leads = Array.isArray(r.data) ? r.data : r.data.leads || [];
        const newLead = leads[leads.length - 1];
        if (newLead) api.post(`/playbooks/generate/${newLead.id}`).catch(e => console.warn('Auto-generate failed for scanned card:', e.message));
      }).catch(e => console.warn('Could not fetch leads for auto-generate:', e.message));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add lead', 'error');
    }
  };

  const addAll = async () => {
    let listId = selectedList;
    if (!listId && newListName) {
      const r = await api.post('/lists', { name: newListName });
      listId = String(r.data.id);
      setLists(l => [...l, r.data]);
      setSelectedList(listId);
    }
    if (!listId) { showToast('Select or create a list first', 'error'); return; }
    setAddingAll(true);
    const ready = queue.filter(c => c.status === 'done' && c.result);
    const leads = ready.map(c => ({ full_name: c.result.name, company: c.result.company, title: c.result.title, email: c.result.email, phone: c.result.phone, linkedin: c.result.linkedin, notes: 'Scanned business card' }));
    try {
      await api.post(`/lists/${listId}/leads`, { leads });
      setQueue(q => q.map(c => c.status === 'done' ? { ...c, status: 'added' } : c));
      showToast(`${leads.length} leads added. Generating playbooks...`, 'success');
      setTimeout(() => navigate(`/lists/${listId}`), 2000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add leads', 'error');
    } finally {
      setAddingAll(false);
    }
  };

  const doneCount = queue.filter(c => c.status === 'done').length;
  const addedCount = queue.filter(c => c.status === 'added').length;
  const pendingCount = queue.filter(c => c.status === 'pending' || c.status === 'error').length;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Card Scanner</div>
        <div style={s.sub}>Upload multiple business cards — scan them all at once, edit the results, then add to a list</div>

        {/* Upload zone */}
        <div style={s.uploadZone}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border2)'; addFiles(e.dataTransfer.files); }}>
          <div style={s.uploadIcon}>📇</div>
          <div style={s.uploadText}>{queue.length > 0 ? `${queue.length} card${queue.length !== 1 ? 's' : ''} loaded — drop more to add` : 'Drop business card images here'}</div>
          <div style={s.uploadSub}>Select multiple files at once · JPG, PNG, HEIC</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        {/* Bulk controls */}
        {queue.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                {queue.length} card{queue.length !== 1 ? 's' : ''}
                {doneCount > 0 ? ` · ${doneCount} scanned` : ''}
                {addedCount > 0 ? ` · ${addedCount} added` : ''}
              </span>
              {pendingCount > 0 && (
                <button style={s.btn('primary')} onClick={scanAll} disabled={scanningAll}>
                  {scanningAll ? `Scanning...` : `🔍 Scan all (${pendingCount})`}
                </button>
              )}
              {doneCount > 0 && (
                <button style={{ ...s.btn('primary'), background: 'var(--success)', border: 'none' }} onClick={addAll} disabled={addingAll}>
                  {addingAll ? 'Adding...' : `✓ Add all to list (${doneCount})`}
                </button>
              )}
            </div>

            {/* List selector */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>→</span>
              {lists.length > 0 ? (
                <select value={selectedList} onChange={e => setSelectedList(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                  <option value="">+ New list</option>
                </select>
              ) : null}
              {(!selectedList || selectedList === '') && (
                <input value={newListName} onChange={e => setNewListName(e.target.value)}
                  placeholder="New list name..."
                  style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 180 }} />
              )}
            </div>
          </div>
        )}

        {/* Card queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {queue.map(card => (
            <div key={card.id} style={{ background: 'var(--bg2)', border: `1px solid ${card.status === 'added' ? 'var(--success)' : card.status === 'error' ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem' }}>
                {/* Image */}
                <div>
                  <img src={card.preview} style={{ width: '100%', borderRadius: 'var(--radius)', objectFit: 'cover', maxHeight: 120 }} alt="card" />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    <span style={s.statusBadge(card.status)}>
                      {card.status === 'pending' ? 'Pending' : card.status === 'scanning' ? '🔍 Scanning...' : card.status === 'done' ? '✓ Scanned' : card.status === 'added' ? '✓ Added' : '✗ Error'}
                    </span>
                    {card.status !== 'added' && (
                      <button style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => removeCard(card.id)}>✕ Remove</button>
                    )}
                  </div>
                  {(card.status === 'pending' || card.status === 'error') && (
                    <button style={{ ...s.btn('primary'), width: '100%', marginTop: 8, padding: '6px', fontSize: 12 }}
                      onClick={() => scanOne(card.id)}>
                      🔍 Scan
                    </button>
                  )}
                  {card.status === 'error' && card.error && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{card.error}</div>
                  )}
                </div>

                {/* Result fields */}
                <div>
                  {card.status === 'scanning' ? (
                    <>
                      <div style={s.row2}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                          <div key={`skeleton-${i}`} style={{ marginBottom: 10 }}>
                            <label style={s.label}>Label</label>
                            <div style={{ height: 32, background: 'var(--bg3)', borderRadius: 'var(--radius)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 36, background: 'var(--bg3)', borderRadius: 'var(--radius)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                    </>
                  ) : card.status === 'done' || card.status === 'added' ? (
                    <>
                      <div style={s.row2}>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Name</label>
                          <input value={card.result?.name || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'name', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Company</label>
                          <input value={card.result?.company || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'company', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Title</label>
                          <input value={card.result?.title || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'title', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Email</label>
                          <input value={card.result?.email || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'email', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>Phone</label>
                          <input value={card.result?.phone || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'phone', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={s.label}>LinkedIn</label>
                          <input value={card.result?.linkedin || ''} disabled={card.status === 'added'}
                            onChange={e => updateResult(card.id, 'linkedin', e.target.value)}
                            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }} />
                        </div>
                      </div>
                      {card.status === 'done' && (
                        <button style={s.addBtn} onClick={() => addOne(card.id)}>
                          ✓ Add {card.result?.name || 'lead'} to list
                        </button>
                      )}
                      {card.status === 'added' && (
                        <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>✓ Added to list</div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--text3)', fontSize: 13, paddingTop: '2rem', textAlign: 'center' }}>
                      {card.status === 'scanning' ? 'Reading card...' : 'Hit Scan to extract contact info'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
