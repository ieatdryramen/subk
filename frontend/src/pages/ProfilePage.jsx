import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 860 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  rowSingle: { marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 },
  saveBtn: { padding: '11px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, border: 'none', cursor: 'pointer' },
  autoFillBtn: { padding: '10px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, borderRadius: 'var(--radius)', fontWeight: 500, cursor: 'pointer' },
  success: { color: 'var(--success)', fontSize: 13, marginLeft: 12 },
  err: { color: 'var(--danger)', fontSize: 13, marginLeft: 12 },
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 },
  roleBtn: (active) => ({
    padding: '10px', textAlign: 'center', borderRadius: 'var(--radius)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-bg)' : 'var(--bg3)',
    color: active ? 'var(--accent2)' : 'var(--text2)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 500 : 400,
  }),
  toneGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 },
  toneBtn: (active) => ({
    padding: '10px 14px', borderRadius: 'var(--radius)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-bg)' : 'var(--bg3)',
    color: active ? 'var(--accent2)' : 'var(--text2)',
    cursor: 'pointer', fontSize: 13, textAlign: 'left', fontWeight: active ? 500 : 400,
  }),
  urlRow: { display: 'flex', gap: 10, marginBottom: 16 },
  contextBox: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 },
  divider: { height: 1, background: 'var(--border)', margin: '0.25rem 0 1rem' },
};

const ROLES = [
  { value: 'SDR', label: 'SDR', desc: 'Book meetings' },
  { value: 'AE', label: 'AE', desc: 'Close deals' },
  { value: 'AM', label: 'AM', desc: 'Expand accounts' },
  { value: 'CSM', label: 'CSM', desc: 'Drive adoption' },
  { value: 'SE', label: 'SE', desc: 'Technical sale' },
];

const TONES = [
  { value: 'direct and confident, like a peer in the GovCon industry who has done their homework', label: 'Direct & confident', desc: 'Peer-level, no nonsense' },
  { value: 'consultative and insight-led, leading with their specific workflow problems before anything else', label: 'Consultative', desc: 'Problem-first, helpful' },
  { value: 'conversational and human, like a trusted colleague who has been in the GovCon world a long time', label: 'Conversational', desc: 'Human, low pressure' },
  { value: 'challenger style, leading with a provocative observation about their current system that reframes their thinking', label: 'Challenger', desc: 'Reframe their thinking' },
  { value: 'formal and precise, with careful business language appropriate for CFO and executive audiences', label: 'Formal & executive', desc: 'C-suite ready' },
  { value: 'like someone who has sat in enough Costpoint demos to know exactly where the bodies are buried — direct, no fluff, genuinely believes this is better, not trying to sell you something you do not need. Peer energy. If it is not a fit I will tell you. If it is, I will show you exactly why.', label: 'Founder energy', desc: 'High conviction' },
];

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: 'SumX AI',
    product: 'Modern ERP built specifically for government contractors — replaces Costpoint, Deltek, and Unanet',
    value_props: 'Everything lives with the record — no hunting across screens\nNo import/export grind — timesheets flow directly to billing\nDCAA-compliant audit trail built in\nImplementation a third the size of a Costpoint migration\nTraining a back-office team takes a day, not weeks',
    icp: 'Government contractors $5M–$150M revenue on Costpoint, Deltek, or Unanet',
    target_titles: 'CFO\nController\nAccounting Manager\nContracts Manager\nCEO / President',
    tone: TONES[5].value,
    objections: "We just implemented Costpoint two years ago\nOur controller knows all the workarounds\nWe're in the middle of a CMMC audit\nWhat happens to our historical data\nThe migration sounds painful",
    sender_name: '',
    sender_role: 'AE',
    custom_tone: '',
    website_url: 'https://sumx.ai',
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [useCustomTone, setUseCustomTone] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api.get('/profile').then(r => {
      if (r.data) {
        setForm(f => ({ ...f, ...r.data }));
        if (r.data.custom_tone) setUseCustomTone(true);
        if (r.data.is_admin) setIsAdmin(true);
      }
    }).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const autoFill = async () => {
    if (!form.website_url) return;
    setAutoFilling(true);
    try {
      const res = await api.post('/autofill', { url: form.website_url });
      setForm(f => ({ ...f, ...res.data }));
      setStatus('autofilled');
    } catch { setStatus('autofill-error'); }
    finally { setAutoFilling(false); }
  };

  const save = async () => {
    setLoading(true); setStatus('');
    try {
      const payload = { ...form };
      if (useCustomTone && form.custom_tone) payload.tone = 'custom';
      await api.post('/profile', payload);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
    } finally { setLoading(false); }
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Company Profile</div>
        <div style={s.sub}>Controls who you are and how you sound. The GovCon knowledge is built into the AI — you just set your name, role, and tone.</div>

        {/* Auto-fill */}
        <div style={s.card}>
          <div style={s.cardTitle}>Auto-fill from website</div>
          <div style={s.divider} />
          <div style={s.urlRow}>
            <input value={form.website_url} onChange={set('website_url')} placeholder="https://sumx.ai" style={{ flex: 1 }} />
            <button style={s.autoFillBtn} onClick={autoFill} disabled={autoFilling || !form.website_url}>
              {autoFilling ? 'Reading...' : '⚡ Auto-fill'}
            </button>
          </div>
          {status === 'autofilled' && <div style={{ color: 'var(--success)', fontSize: 13 }}>✓ Filled from website — review below</div>}
        </div>

        {/* Who you are */}
        <div style={s.card}>
          <div style={s.cardTitle}>Who you are</div>
          <div style={s.cardSub}>This personalizes every email signature and call opener.</div>
          <div style={s.divider} />
          <div style={s.roleGrid}>
            {ROLES.map(r => (
              <div key={r.value} style={s.roleBtn(form.sender_role === r.value)} onClick={() => setForm(f => ({ ...f, sender_role: r.value }))}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{r.desc}</div>
              </div>
            ))}
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Your name</label>
              <input value={form.sender_name} onChange={set('sender_name')} placeholder="Jack" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Company name</label>
              <input value={form.name} onChange={set('name')} placeholder="SumX AI" />
            </div>
          </div>
        </div>

        {/* What you sell — admin only */}
        {isAdmin && <div style={s.card}>
          <div style={s.cardTitle}>What you sell</div>
          <div style={s.cardSub}>Keep this sharp and honest. It feeds into research and email generation.</div>
          <div style={s.divider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Product — one sentence</label>
              <input value={form.product} onChange={set('product')} placeholder="Modern ERP built specifically for government contractors" />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>What actually makes it different</label>
              <textarea value={form.value_props} onChange={set('value_props')} style={{ minHeight: 110 }} />
              <span style={s.hint}>One per line. What actually impresses people in demos — not marketing copy.</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Ideal customer</label>
              <textarea value={form.icp} onChange={set('icp')} style={{ minHeight: 80 }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Target titles</label>
              <textarea value={form.target_titles} onChange={set('target_titles')} style={{ minHeight: 80 }} />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Objections you hear constantly</label>
              <textarea value={form.objections} onChange={set('objections')} style={{ minHeight: 80 }} />
              <span style={s.hint}>One per line — the AI writes specific rebuttals for each one.</span>
            </div>
          </div>
        </div>

        </div>}

        {/* Member view — company context is set by admin */}
        {!isAdmin && (
          <div style={s.card}>
            <div style={s.cardTitle}>Company context</div>
            <div style={s.cardSub}>Set by your org admin — applies to everyone on the team.</div>
            <div style={s.divider} />
            <div style={s.contextBox}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text)' }}>Product:</strong> {form.product || 'Not set by admin yet'}</div>
              <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text)' }}>Positioning:</strong> Costpoint, Deltek, Unanet replacements</div>
              <div style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text)' }}>Compliance:</strong> DCAA, CMMC, DFARS, FAR</div>
              <div><strong style={{ color: 'var(--text)' }}>Core pain points, buyer personas, migration framing</strong> — all locked in by admin</div>
            </div>
          </div>
        )}

        {/* Built-in GovCon context */}
        <div style={s.card}>
          <div style={s.cardTitle}>🔒 Built-in GovCon intelligence</div>
          <div style={s.cardSub}>This knowledge is locked into the AI — it doesn't need to live in a form.</div>
          <div style={s.divider} />
          <div style={s.contextBox}>
            <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Positioning against:</strong> Costpoint, Deltek Vision/Vantagepoint, Unanet, QuickBooks</div>
            <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Compliance context:</strong> DCAA, CMMC, DFARS, FAR — built into every playbook</div>
            <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Core pain points:</strong> Multi-screen workflows, manual import/export, hunting for audit docs, character limits, wage determination maintenance, key-person dependency risk</div>
            <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Buyer personas:</strong> Controller (fears migration), CFO (DCAA risk + key-person), Contracts Manager (project setup + billing), Program Manager (timesheet visibility)</div>
            <div><strong style={{ color: 'var(--text)' }}>Migration framing:</strong> Third the size of Costpoint migration, we do the heavy lifting, hybrid start available, history always accessible</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            To update this context, contact your admin. It applies to every playbook generated.
          </div>
        </div>

        {/* Tone */}
        <div style={s.card}>
          <div style={s.cardTitle}>Tone & style</div>
          <div style={s.cardSub}>How you sound in emails and on calls.</div>
          <div style={s.divider} />
          <div style={s.toneGrid}>
            {TONES.map(t => (
              <div key={t.label} style={s.toneBtn(!useCustomTone && form.tone === t.value)}
                onClick={() => { setUseCustomTone(false); setForm(f => ({ ...f, tone: t.value })); }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="checkbox" id="customTone" checked={useCustomTone} onChange={e => setUseCustomTone(e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor="customTone" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Write my own tone description</label>
            </div>
            {useCustomTone && (
              <textarea value={form.custom_tone} onChange={set('custom_tone')}
                placeholder="Describe exactly how you want to sound..."
                style={{ minHeight: 80 }} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '2rem' }}>
          <button style={s.saveBtn} onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
          {status === 'saved' && <span style={s.success}>✓ Saved — regenerate leads to use the new profile</span>}
          {status === 'error' && <span style={s.err}>Failed to save — check console</span>}
        </div>
      </div>
    </Layout>
  );
}
