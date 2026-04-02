import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 800 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  uploadZone: { border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '1.5rem', background: 'var(--bg2)' },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadText: { fontSize: 15, fontWeight: 500, marginBottom: 6 },
  uploadSub: { fontSize: 13, color: 'var(--text2)' },
  preview: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' },
  previewImg: { width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 'var(--radius)', marginBottom: '1rem' },
  scanBtn: { width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: '1rem' },
  resultCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  resultTitle: { fontSize: 14, fontWeight: 600, marginBottom: '1rem', color: 'var(--text)' },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  listSelect: { marginBottom: 12 },
  addBtn: { width: '100%', padding: '11px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  status: (t) => ({ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: '1rem', background: t === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', color: t === 'success' ? 'var(--success)' : 'var(--danger)', border: `1px solid var(--${t})` }),
};

export default function CardScanPage() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName] = useState('');
  const [adding, setAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const fileRef = useRef();
  const navigate = useNavigate();

  useState(() => {
    api.get('/lists').then(r => {
      setLists(r.data);
      if (r.data.length) setSelectedList(r.data[0].id);
    });
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target.result);
      setImageData(e.target.result.split(',')[1]);
      setResult(null);
      setStatusMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (!imageData) return;
    setScanning(true);
    try {
      const r = await api.post('/cardscan/scan', { imageData });
      setResult(r.data);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const addToList = async () => {
    if (!result) return;
    setAdding(true);
    try {
      let listId = selectedList;
      if (!listId && newListName) {
        const r = await api.post('/lists', { name: newListName });
        listId = r.data.id;
        setLists(l => [...l, r.data]);
        setSelectedList(listId);
      }
      if (!listId) { alert('Select or create a list first'); setAdding(false); return; }
      await api.post(`/lists/${listId}/leads`, { leads: [{
        full_name: result.name,
        company: result.company,
        title: result.title,
        email: result.email,
        linkedin: result.linkedin,
        notes: result.notes || `Scanned business card`,
      }]});
      setStatusMsg({ type: 'success', text: `${result.name} added to list. Generating playbook...` });
      // Auto-generate playbook
      const leadsRes = await api.get(`/lists/${listId}/leads`);
      const newLead = leadsRes.data[leadsRes.data.length - 1];
      if (newLead) {
        api.post(`/playbooks/generate/${newLead.id}`).catch(() => {});
      }
      setTimeout(() => navigate(`/lists/${listId}`), 1500);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add lead' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Card Scanner</div>
        <div style={s.sub}>Scan a business card and instantly add it as a lead with a generated playbook</div>

        {!image ? (
          <div style={s.uploadZone}
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border2)'; handleFile(e.dataTransfer.files[0]); }}>
            <div style={s.uploadIcon}>📇</div>
            <div style={s.uploadText}>Drop a business card image here</div>
            <div style={s.uploadSub}>or click to browse · JPG, PNG, HEIC</div>
          </div>
        ) : (
          <div style={s.preview}>
            <img src={image} style={s.previewImg} alt="Business card" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={s.scanBtn} onClick={scan} disabled={scanning}>
                {scanning ? '🔍 Scanning...' : '🔍 Scan card'}
              </button>
              <button style={{ ...s.scanBtn, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                onClick={() => { setImage(null); setImageData(null); setResult(null); }}>
                Try another
              </button>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

        {statusMsg && (
          <div style={s.status(statusMsg.type)}>{statusMsg.text}</div>
        )}

        {result && (
          <div style={s.resultCard}>
            <div style={s.resultTitle}>✓ Card scanned — review and confirm</div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Name</label>
                <input value={result.name || ''} onChange={e => setResult(r => ({ ...r, name: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Company</label>
                <input value={result.company || ''} onChange={e => setResult(r => ({ ...r, company: e.target.value }))} />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Title</label>
                <input value={result.title || ''} onChange={e => setResult(r => ({ ...r, title: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input value={result.email || ''} onChange={e => setResult(r => ({ ...r, email: e.target.value }))} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Phone</label>
              <input value={result.phone || ''} onChange={e => setResult(r => ({ ...r, phone: e.target.value }))} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={s.label}>Add to list</div>
              {lists.length > 0 ? (
                <select style={{ marginBottom: 10 }} value={selectedList} onChange={e => setSelectedList(e.target.value)}>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  <option value="">+ Create new list</option>
                </select>
              ) : null}
              {(!selectedList || selectedList === '') && (
                <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="New list name e.g. Conference Leads" style={{ marginBottom: 10 }} />
              )}
              <button style={s.addBtn} onClick={addToList} disabled={adding}>
                {adding ? 'Adding...' : `✓ Add ${result.name || 'lead'} & generate playbook`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
