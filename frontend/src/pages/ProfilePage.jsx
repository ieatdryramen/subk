import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 },
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
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  urlRow: { display: 'flex', gap: 10, marginBottom: 16 },
  painItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', marginBottom: 6, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 },
  sectionDivider: { height: 1, background: 'var(--border)', margin: '0.5rem 0 1rem' },
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
  { value: 'energetic and direct, like a founder who knows this problem inside out and has genuine conviction in the solution', label: 'Founder energy', desc: 'High conviction' },
];

const LEGACY_SYSTEMS = [
  'Costpoint', 'Deltek Vision', 'Deltek Vantagepoint', 'Unanet', 'QuickBooks', 'Sage Intacct', 'Microsoft Dynamics', 'Unknown / Other'
];

const COMPLIANCE_OPTIONS = ['DCAA', 'CMMC', 'DFARS', 'FAR', 'CAS', 'SOX'];

// The real pain points from actual SumX demos — pre-populated, editable
const DEFAULT_WORKFLOW_PAINS = `3-4 screens to do one thing in Costpoint — security, rates, project setup
Hunting for posted documents during audits — not attached to the record
Wage determination maintenance across multiple screens just to update workforce rates
30 character project number limit forcing creative naming workarounds
Manual import/export grind for timesheets, billing, and reports
Running build-compute-update-project just to see a project report
VLOOKUP chains between Costpoint and Excel just to see budget vs actuals
Fear that only one person understands the system and if they leave it all breaks`;

const DEFAULT_BUYER_PERSONAS = `Controller / Accounting Manager: Does the work every day. Fears migration and system change. Win them over by showing their day gets easier, not harder. "Like QuickBooks and Costpoint had a baby."
CFO / CEO: Cares about DCAA compliance, audit risk, cash flow velocity, and not being dependent on one person who knows all the workarounds.
Contracts Manager: Cares about project setup, workforce rates, mods attached to the right contract, billing accuracy.
Program Manager: Cares about timesheet approval speed and project visibility.`;

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: '', product: '', value_props: '', icp: '', target_titles: '',
    tone: TONES[0].value, objections: '', sender_name: '', sender_role: 'AE',
    custom_tone: '', website_url: '',
    // GovCon-specific fields
    legacy_system: 'Costpoint',
    compliance_focus: [],
    workflow_pains: DEFAULT_WORKFLOW_PAINS,
    buyer_personas: DEFAULT_BUYER_PERSONAS,
    migration_notes: '',
    govcon_mode: true,
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [useCustomTone, setUseCustomTone] = useState(false);

  useEffect(() => {
    api.get('/profile').then(r => {
      if (r.data) {
        const data = { ...r.data };
        if (typeof data.compliance_focus === 'string') {
          try { data.compliance_focus = JSON.parse(data.compliance_focus); } catch { data.compliance_focus = []; }
        }
        if (!data.workflow_pains) data.workflow_pains = DEFAULT_WORKFLOW_PAINS;
        if (!data.buyer_personas) data.buyer_personas = DEFAULT_BUYER_PERSONAS;
        setForm(f => ({ ...f, ...data }));
        if (data.custom_tone) setUseCustomTone(true);
      }
    }).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleCompliance = (opt) => {
    setForm(f => {
      const curr = Array.isArray(f.compliance_focus) ? f.compliance_focus : [];
      return { ...f, compliance_focus: curr.includes(opt) ? curr.filter(x => x !== opt) : [...curr, opt] };
    });
  };

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
      const payload = {
        ...form,
        compliance_focus: JSON.stringify(Array.isArray(form.compliance_focus) ? form.compliance_focus : []),
      };
      if (useCustomTone && form.custom_tone) payload.tone = form.custom_tone;
      await api.post('/profile', payload);
      setStatus('saved');
    } catch { setStatus('error'); }
    finally { setLoading(false); }
  };

  const complianceArr = Array.isArray(form.compliance_focus) ? form.compliance_focus : [];

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Company Profile</div>
        <div style={s.sub}>Everything here feeds directly into playbook generation. The more specific and honest you are, the better the output.</div>

        {/* Auto-fill */}
        <div style={s.card}>
          <div style={s.cardTitle}>Auto-fill from website</div>
          <div style={s.urlRow}>
            <input value={form.website_url} onChange={set('website_url')} placeholder="https://sumx.ai" style={{ flex: 1 }} />
            <button style={s.autoFillBtn} onClick={autoFill} disabled={autoFilling || !form.website_url}>
              {autoFilling ? 'Reading site...' : '⚡ Auto-fill'}
            </button>
          </div>
          {status === 'autofilled' && <div style={{ color: 'var(--success)', fontSize: 13 }}>✓ Profile filled — review below</div>}
          {status === 'autofill-error' && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Could not read site — fill in manually</div>}
        </div>

        {/* Sender */}
        <div style={s.card}>
          <div style={s.cardTitle}>Who you are</div>
          <div style={s.sectionDivider} />
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
              <input value={form.name} onChange={set('name')} placeholder="SumX" />
            </div>
          </div>
        </div>

        {/* What you sell */}
        <div style={s.card}>
          <div style={s.cardTitle}>What you sell</div>
          <div style={s.sectionDivider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Product description</label>
              <input value={form.product} onChange={set('product')} placeholder="Modern ERP for government contractors — replaces Costpoint and Deltek" />
              <span style={s.hint}>One sentence. What it is, not what it does.</span>
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>What actually makes it different</label>
              <textarea value={form.value_props} onChange={set('value_props')} placeholder={"Everything lives with the record — no more hunting across screens\nBilling, audit trail, approvals all in one place\nImplementation a third the size of a Costpoint migration\nTraining a back-office team takes a day, not weeks"} style={{ minHeight: 100 }} />
              <span style={s.hint}>One per line. Be specific — what actually impresses people in demos.</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Ideal customer</label>
              <textarea value={form.icp} onChange={set('icp')} placeholder={"GovCon firms $5M–$150M revenue\nCurrently on Costpoint, Deltek, or QuickBooks\nDCAA-auditable, mostly T&M and FFP contracts\nFrustrated with their current ERP"} style={{ minHeight: 90 }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Target titles</label>
              <textarea value={form.target_titles} onChange={set('target_titles')} placeholder={"CFO\nController\nAccounting Manager\nContracts Manager\nCEO / President\nDirector of Finance"} style={{ minHeight: 90 }} />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Objections you hear constantly</label>
              <textarea value={form.objections} onChange={set('objections')} placeholder={"We just implemented Costpoint two years ago\nOur controller knows all the workarounds — bad timing\nWe're too small / too big\nWe can't migrate right now — CMMC audit coming\nWhat about our historical data"} style={{ minHeight: 80 }} />
              <span style={s.hint}>One per line — the AI writes specific rebuttals for each one.</span>
            </div>
          </div>
        </div>

        {/* GovCon context */}
        <div style={s.card}>
          <div style={s.cardTitle}>GovCon context</div>
          <div style={s.cardSub}>This is what separates SumX messaging from generic ERP messaging. Be honest — this feeds directly into the AI.</div>
          <div style={s.sectionDivider} />

          {/* Legacy system */}
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Legacy system prospects are typically coming from</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {LEGACY_SYSTEMS.map(sys => (
                <button key={sys}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)',
                    border: form.legacy_system === sys ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: form.legacy_system === sys ? 'var(--accent-bg)' : 'var(--bg3)',
                    color: form.legacy_system === sys ? 'var(--accent2)' : 'var(--text2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setForm(f => ({ ...f, legacy_system: sys }))}>
                  {sys}
                </button>
              ))}
            </div>
          </div>

          {/* Compliance */}
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Compliance frameworks your prospects deal with</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {COMPLIANCE_OPTIONS.map(opt => (
                <button key={opt}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)',
                    border: complianceArr.includes(opt) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: complianceArr.includes(opt) ? 'var(--accent-bg)' : 'var(--bg3)',
                    color: complianceArr.includes(opt) ? 'var(--accent2)' : 'var(--text2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleCompliance(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Workflow pains */}
          <div style={{ marginBottom: 16 }}>
            <div style={s.field}>
              <label style={s.label}>Specific workflow pains you hear in demos</label>
              <textarea value={form.workflow_pains} onChange={set('workflow_pains')} style={{ minHeight: 160, fontSize: 12, lineHeight: 1.6 }} />
              <span style={s.hint}>These go directly into the AI. The more specific and real, the better the output. Edit freely — add what you actually hear.</span>
            </div>
          </div>

          {/* Buyer personas */}
          <div style={{ marginBottom: 16 }}>
            <div style={s.field}>
              <label style={s.label}>Buyer personas — what each role actually cares about</label>
              <textarea value={form.buyer_personas} onChange={set('buyer_personas')} style={{ minHeight: 130, fontSize: 12, lineHeight: 1.6 }} />
              <span style={s.hint}>This helps the AI write differently for a CFO vs a Controller vs a Contracts Manager.</span>
            </div>
          </div>

          {/* Migration notes */}
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Migration / timing context</label>
              <textarea value={form.migration_notes} onChange={set('migration_notes')} placeholder={"Implementation is a third the size of a Costpoint migration\nWe do the heavy lifting — they just validate and train\nSingle sign-on deadline creating natural forcing function to switch\nHistorical data can be imported — we've done it before"} style={{ minHeight: 80 }} />
              <span style={s.hint}>What do you tell prospects who are scared about switching? This gets baked into objection handling.</span>
            </div>
          </div>
        </div>

        {/* Tone */}
        <div style={s.card}>
          <div style={s.cardTitle}>Tone & style</div>
          <div style={s.sectionDivider} />
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
              <label htmlFor="customTone" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Write my own tone description</label>
            </div>
            {useCustomTone && (
              <textarea value={form.custom_tone} onChange={set('custom_tone')}
                placeholder="E.g. 'Like a former GovCon controller who now sells software — I know Costpoint from the inside, I know what a DCAA audit feels like, and I am not here to pitch. I am here to show you something better.'"
                style={{ minHeight: 80 }} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '2rem' }}>
          <button style={s.saveBtn} onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
          {status === 'saved' && <span style={s.success}>✓ Saved — new playbooks will use this profile</span>}
          {status === 'error' && <span style={s.err}>Failed to save</span>}
        </div>
      </div>
    </Layout>
  );
}
