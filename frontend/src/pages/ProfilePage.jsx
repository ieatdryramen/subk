import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 860 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  rowSingle: { marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  hint: { fontSize: 12, color: 'var(--text3)', marginTop: 4 },
  saveBtn: { padding: '11px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, border: 'none' },
  autoFillBtn: { padding: '10px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, borderRadius: 'var(--radius)', fontWeight: 500, cursor: 'pointer' },
  success: { color: 'var(--success)', fontSize: 13, marginLeft: 12 },
  err: { color: 'var(--danger)', fontSize: 13, marginLeft: 12 },
  divider: { height: 1, background: 'var(--border)', margin: '1.5rem 0' },
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 },
  roleBtn: (active) => ({
    padding: '10px', textAlign: 'center', borderRadius: 'var(--radius)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-bg)' : 'var(--bg3)',
    color: active ? 'var(--accent2)' : 'var(--text2)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 500 : 400,
  }),
  roleName: { fontWeight: 600, marginBottom: 2 },
  roleDesc: { fontSize: 11, color: 'inherit', opacity: 0.8 },
  toneGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 },
  toneBtn: (active) => ({
    padding: '10px 14px', borderRadius: 'var(--radius)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-bg)' : 'var(--bg3)',
    color: active ? 'var(--accent2)' : 'var(--text2)',
    cursor: 'pointer', fontSize: 13, textAlign: 'left', fontWeight: active ? 500 : 400,
  }),
  urlRow: { display: 'flex', gap: 10, marginBottom: 16 },
};

const ROLES = [
  { value: 'SDR', label: 'SDR', desc: 'Book meetings' },
  { value: 'AE', label: 'AE', desc: 'Close deals' },
  { value: 'AM', label: 'AM', desc: 'Expand accounts' },
  { value: 'CSM', label: 'CSM', desc: 'Drive adoption' },
  { value: 'SE', label: 'SE', desc: 'Technical sale' },
];

const TONES = [
  { value: 'direct and confident, like a peer in the industry who has done their homework', label: 'Direct & confident', desc: 'Peer-level, no nonsense' },
  { value: 'consultative and insight-led, leading with business problems before solutions', label: 'Consultative', desc: 'Problem-first, helpful' },
  { value: 'energetic and bold, like a founder who believes deeply in what they are building', label: 'Energetic & bold', desc: 'Founder energy' },
  { value: 'formal and precise, with careful business language appropriate for executive audiences', label: 'Formal & executive', desc: 'C-suite ready' },
  { value: 'conversational and human, like a trusted colleague not a sales rep', label: 'Conversational', desc: 'Human, low pressure' },
  { value: 'challenger style, leading with a provocative insight that reframes their thinking', label: 'Challenger', desc: 'Reframe their thinking' },
];

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: '', product: '', value_props: '', icp: '', target_titles: '',
    tone: TONES[0].value, objections: '', sender_name: '', sender_role: 'AE',
    custom_tone: '', website_url: '',
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [useCustomTone, setUseCustomTone] = useState(false);

  useEffect(() => {
    api.get('/profile').then(r => {
      if (r.data) {
        setForm(f => ({ ...f, ...r.data }));
        if (r.data.custom_tone) setUseCustomTone(true);
      }
    }).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const autoFill = async () => {
    if (!form.website_url) return;
    setAutoFilling(true);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Visit this website and extract company information to fill out a sales profile: ${form.website_url}

Return a JSON object with these exact keys:
{
  "name": "company name",
  "product": "one sentence description of what they sell",
  "value_props": "3-5 key value propositions, one per line",
  "icp": "description of their ideal customer profile based on their website",
  "target_titles": "likely buyer titles they sell to, one per line"
}

Return ONLY the JSON, no markdown.`,
          }],
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        }),
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim().replace(/^```json|^```|```$/gm, '').trim();
      const parsed = JSON.parse(text);
      setForm(f => ({ ...f, ...parsed }));
      setStatus('autofilled');
    } catch (err) {
      setStatus('autofill-error');
    } finally {
      setAutoFilling(false);
    }
  };

  const save = async () => {
    setLoading(true); setStatus('');
    try {
      const payload = { ...form };
      if (useCustomTone && form.custom_tone) payload.tone = form.custom_tone;
      await api.post('/profile', payload);
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
        <div style={s.sub}>The foundation for every personalized playbook. Fill this in thoroughly — it directly affects output quality.</div>

        {/* Auto-fill from website */}
        <div style={s.card}>
          <div style={s.cardTitle}>Auto-fill from your website</div>
          <div style={s.urlRow}>
            <input value={form.website_url} onChange={set('website_url')} placeholder="https://yourcompany.com" style={{ flex: 1 }} />
            <button style={s.autoFillBtn} onClick={autoFill} disabled={autoFilling || !form.website_url}>
              {autoFilling ? 'Reading site...' : '⚡ Auto-fill profile'}
            </button>
          </div>
          {status === 'autofilled' && <div style={{ color: 'var(--success)', fontSize: 13 }}>✓ Profile filled from website — review and adjust below</div>}
          {status === 'autofill-error' && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Could not read site — fill in manually below</div>}
        </div>

        {/* Your role */}
        <div style={s.card}>
          <div style={s.cardTitle}>Your role</div>
          <div style={s.roleGrid}>
            {ROLES.map(r => (
              <div key={r.value} style={s.roleBtn(form.sender_role === r.value)} onClick={() => setForm(f => ({ ...f, sender_role: r.value }))}>
                <div style={s.roleName}>{r.label}</div>
                <div style={s.roleDesc}>{r.desc}</div>
              </div>
            ))}
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Your name</label>
              <input value={form.sender_name} onChange={set('sender_name')} placeholder="e.g. Jack" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Company name</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. SumX AI" />
            </div>
          </div>
        </div>

        {/* What you sell */}
        <div style={s.card}>
          <div style={s.cardTitle}>What you sell</div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Product / service</label>
              <input value={form.product} onChange={set('product')} placeholder="e.g. AI-powered ERP for government contractors" />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Value propositions</label>
              <textarea value={form.value_props} onChange={set('value_props')} placeholder={"Automates subcontractor compliance tracking\nSurfaces SAM.gov opportunities in real time\nCuts proposal prep time by 60%"} style={{ minHeight: 90 }} />
              <span style={s.hint}>One per line — be specific, not generic</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Ideal customer profile</label>
              <textarea value={form.icp} onChange={set('icp')} placeholder="Government contractors $5M-$100M revenue, pursuing 8(a) or SDVOSB certifications" style={{ minHeight: 80 }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Target titles</label>
              <textarea value={form.target_titles} onChange={set('target_titles')} placeholder={"VP of Business Development\nDirector of Contracts\nCFO\nCEO"} style={{ minHeight: 80 }} />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Common objections</label>
              <textarea value={form.objections} onChange={set('objections')} placeholder={"We already use a legacy solution\nWe don't have budget right now\nWe're too small"} style={{ minHeight: 70 }} />
              <span style={s.hint}>One per line — the AI will write specific rebuttals for each</span>
            </div>
          </div>
        </div>

        {/* Tone */}
        <div style={s.card}>
          <div style={s.cardTitle}>Tone & style</div>
          <div style={s.toneGrid}>
            {TONES.map(t => (
              <div key={t.value} style={s.toneBtn(!useCustomTone && form.tone === t.value)}
                onClick={() => { setUseCustomTone(false); setForm(f => ({ ...f, tone: t.value })); }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="checkbox" id="customTone" checked={useCustomTone} onChange={e => setUseCustomTone(e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor="customTone" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Use custom tone description</label>
            </div>
            {useCustomTone && (
              <textarea value={form.custom_tone} onChange={set('custom_tone')}
                placeholder="Describe exactly how you want the AI to sound. E.g. 'Like a former military officer who now sells enterprise software — direct, no fluff, respects the prospect's time, frames everything in terms of mission and outcomes.'"
                style={{ minHeight: 80 }} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={s.saveBtn} onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
          {status === 'saved' && <span style={s.success}>✓ Saved</span>}
          {status === 'error' && <span style={s.err}>Failed to save</span>}
        </div>
      </div>
    </Layout>
  );
}
