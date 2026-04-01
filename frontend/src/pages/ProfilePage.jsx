import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 800 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  rowSingle: { marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  hint: { fontSize: 12, color: 'var(--text3)', marginTop: 4 },
  saveBtn: { padding: '11px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500 },
  success: { color: 'var(--success)', fontSize: 13, marginLeft: 12 },
  err: { color: 'var(--danger)', fontSize: 13, marginLeft: 12 },
  divider: { height: 1, background: 'var(--border)', margin: '1.5rem 0' },
};

const tones = [
  { value: 'direct and confident, like a peer in the industry', label: 'Direct & confident (peer-to-peer)' },
  { value: 'consultative and helpful, focusing on solving their problems', label: 'Consultative & helpful' },
  { value: 'energetic and bold, like a startup founder pitching their vision', label: 'Energetic & bold' },
  { value: 'formal and professional, with precise business language', label: 'Formal & professional' },
];

export default function ProfilePage() {
  const [form, setForm] = useState({ name:'', product:'', value_props:'', icp:'', target_titles:'', tone: tones[0].value, objections:'', sender_name:'' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/profile').then(r => { if (r.data) setForm(f => ({ ...f, ...r.data })); }).catch(()=>{});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setLoading(true); setStatus('');
    try {
      await api.post('/profile', form);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Company Profile</div>
        <div style={s.sub}>This is the foundation for every personalized playbook. Fill it in thoroughly.</div>
        <div style={s.card}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Company name</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. SumX AI" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Your name & role</label>
              <input value={form.sender_name} onChange={set('sender_name')} placeholder="e.g. Jack, Founder" />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>What you sell</label>
              <input value={form.product} onChange={set('product')} placeholder="e.g. AI-powered ERP for government contractors" />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Value propositions</label>
              <textarea value={form.value_props} onChange={set('value_props')} placeholder={"Automates subcontractor compliance tracking\nSurfaces SAM.gov opportunities in real time\nCuts proposal prep time by 60%"} style={{ minHeight: 90 }} />
              <span style={s.hint}>One per line</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Ideal customer profile (ICP)</label>
              <textarea value={form.icp} onChange={set('icp')} placeholder="Government contractors with $5M-$100M revenue, prime contractors or growing subs pursuing 8(a) or SDVOSB certifications" style={{ minHeight: 90 }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Target titles & personas</label>
              <textarea value={form.target_titles} onChange={set('target_titles')} placeholder={"VP of Business Development\nDirector of Contracts\nCFO\nCEO (small firms)"} style={{ minHeight: 90 }} />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Tone & style</label>
              <select value={form.tone} onChange={set('tone')}>
                {tones.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Common objections you face</label>
              <textarea value={form.objections} onChange={set('objections')} placeholder={"We already use Deltek\nWe don't have budget right now\nWe're too small for an ERP"} style={{ minHeight: 70 }} />
              <span style={s.hint}>One per line</span>
            </div>
          </div>
          <div style={s.divider} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={s.saveBtn} onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
            {status === 'saved' && <span style={s.success}>✓ Profile saved</span>}
            {status === 'error' && <span style={s.err}>Failed to save</span>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
