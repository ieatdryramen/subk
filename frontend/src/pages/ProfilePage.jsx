import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import api from '../lib/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1000 },
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
  secondaryBtn: { padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, borderRadius: 'var(--radius)', fontWeight: 500, cursor: 'pointer', marginRight: 8 },
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
  certGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 },
  certBox: { display: 'flex', alignItems: 'center', gap: 8 },
  certCheckbox: { width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' },
  urlRow: { display: 'flex', gap: 10, marginBottom: 16 },
  contextBox: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 },
  divider: { height: 1, background: 'var(--border)', margin: '0.25rem 0 1rem' },
  skeleton: { background: 'var(--bg3)', borderRadius: 'var(--radius)', animation: 'pulse 2s ease-in-out infinite', marginBottom: 8 },
  skeletonLine: { height: 16, borderRadius: 4 },
  skeletonInput: { height: 40, borderRadius: 'var(--radius)', marginBottom: 12 },
  progressBar: { background: 'var(--bg3)', borderRadius: 8, height: 8, marginTop: 12, overflow: 'hidden' },
  progressFill: (percent) => ({ background: 'var(--success)', height: '100%', width: `${percent}%`, transition: 'width 0.3s ease' }),
  progressLabel: { fontSize: 12, color: 'var(--text2)', marginTop: 6 },
  tagInput: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { background: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 },
  tagRemove: { cursor: 'pointer', fontWeight: 'bold', opacity: 0.7 },
  capabilityHtml: { lineHeight: 1.8, fontSize: 13, color: 'var(--text)', maxHeight: '60vh', overflowY: 'auto', background: 'var(--bg3)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' },
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
  { value: 'like someone who has sat in enough Costpoint demos to know exactly where the bodies are buried. Direct, no fluff, genuinely believes this is better, not trying to sell you something you do not need. Peer energy. If it is not a fit, say so. If it is, show exactly why.', label: 'Founder energy', desc: 'High conviction' },
];

const CERTIFICATIONS = [
  { value: '8a', label: '8(a) Business Development' },
  { value: 'hubzone', label: 'HUBZone' },
  { value: 'wosb', label: 'WOSB' },
  { value: 'edwosb', label: 'EDWOSB' },
  { value: 'sdvosb', label: 'SDVOSB' },
  { value: 'mbe', label: 'MBE' },
  { value: 'dbe', label: 'DBE' },
  { value: 'sdb', label: 'SDB' },
];

export default function ProfilePage() {
  const toast = useToast();
  const [form, setForm] = useState({
    // ProspectForge fields
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
    email_signature: '',
    // SubK/Company Profile fields
    company_phone: '',
    company_email: '',
    company_address: '',
    cage_code: '',
    uei: '',
    duns: '',
    naics_codes: '',
    certifications: [],
    core_capabilities: '',
    past_performance: '',
    differentiators: '',
    team_members: [],
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [useCustomTone, setUseCustomTone] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCapabilityModal, setShowCapabilityModal] = useState(false);
  const [capabilityText, setCapabilityText] = useState('');
  const [generatingCapability, setGeneratingCapability] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);

  useEffect(() => {
    api.get('/profile').then(r => {
      if (r.data) {
        const parsed = { ...form, ...r.data };
        if (r.data.certifications) {
          try {
            parsed.certifications = typeof r.data.certifications === 'string'
              ? JSON.parse(r.data.certifications)
              : r.data.certifications;
          } catch (e) {
            parsed.certifications = [];
          }
        }
        if (r.data.team_members) {
          try {
            parsed.team_members = typeof r.data.team_members === 'string'
              ? JSON.parse(r.data.team_members)
              : r.data.team_members;
          } catch (e) {
            parsed.team_members = [];
          }
        }
        setForm(parsed);
        if (r.data.custom_tone) setUseCustomTone(true);
        if (r.data.is_admin) setIsAdmin(true);
      }
    }).catch(err => {
      console.error('Failed to load profile:', err);
      setStatus('load-error');
      toast.addToast('Failed to load profile', 'error');
    });
  }, []);

  const set = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    debounceAutoSave();
  };

  const debounceAutoSave = () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => {
      performAutoSave();
    }, 2000);
    setAutoSaveTimer(timer);
  };

  const performAutoSave = async () => {
    try {
      const payload = { ...form };
      if (useCustomTone && form.custom_tone) payload.tone = 'custom';
      payload.certifications = JSON.stringify(form.certifications);
      payload.team_members = JSON.stringify(form.team_members);
      await api.post('/profile', payload);
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  const toggleCertification = (cert) => {
    setForm(f => ({
      ...f,
      certifications: f.certifications.includes(cert)
        ? f.certifications.filter(c => c !== cert)
        : [...f.certifications, cert]
    }));
    debounceAutoSave();
  };

  const addTeamMember = () => {
    setForm(f => ({
      ...f,
      team_members: [...f.team_members, { name: '', title: '' }]
    }));
  };

  const removeTeamMember = (idx) => {
    setForm(f => ({
      ...f,
      team_members: f.team_members.filter((_, i) => i !== idx)
    }));
    debounceAutoSave();
  };

  const updateTeamMember = (idx, field, value) => {
    setForm(f => ({
      ...f,
      team_members: f.team_members.map((tm, i) => i === idx ? { ...tm, [field]: value } : tm)
    }));
    debounceAutoSave();
  };

  const calculateCompleteness = () => {
    const fields = [
      form.name, form.company_email, form.company_phone,
      form.cage_code, form.uei, form.duns,
      form.naics_codes, form.core_capabilities,
      form.past_performance, form.differentiators,
      form.team_members.length > 0
    ];
    const filled = fields.filter(f => f).length;
    return Math.round((filled / fields.length) * 100);
  };

  const getMissingItems = () => {
    const missing = [];
    if (!form.name) missing.push('Company name');
    if (!form.company_email) missing.push('Email address');
    if (!form.company_phone) missing.push('Phone number');
    if (!form.cage_code) missing.push('CAGE code');
    if (!form.uei) missing.push('UEI');
    if (!form.duns) missing.push('DUNS number');
    if (!form.naics_codes) missing.push('NAICS codes');
    if (!form.core_capabilities) missing.push('Core capabilities');
    if (!form.past_performance) missing.push('Past performance');
    if (!form.differentiators) missing.push('Differentiators');
    if (form.team_members.length === 0) missing.push('Team members');
    return missing;
  };

  const autoFill = async () => {
    if (!form.website_url) return;
    setAutoFilling(true);
    try {
      const res = await api.post('/autofill', { url: form.website_url });
      setForm(f => ({ ...f, ...res.data }));
      setStatus('autofilled');
      toast.addToast('Filled from website — review below', 'success');
    } catch {
      setStatus('autofill-error');
      toast.addToast('Could not read website — fill in manually below', 'error');
    }
    finally { setAutoFilling(false); }
  };

  const generateCapabilityStatement = async () => {
    setGeneratingCapability(true);
    try {
      const teamPersonnel = form.team_members.map(m => `${m.name} - ${m.title}`).join('\n');
      const res = await api.post('/chat/general', {
        messages: [{
          role: 'user',
          content: `Generate a one-page capability statement for this government contractor in professional, concise government contracting style. Return only the HTML content, no extra text.

Company: ${form.name}
Website: ${form.website_url}
Phone: ${form.company_phone}
Email: ${form.company_email}
Address: ${form.company_address}

CAGE Code: ${form.cage_code}
UEI: ${form.uei}
DUNS: ${form.duns}

NAICS Codes: ${form.naics_codes}
Certifications: ${form.certifications.join(', ') || 'None'}

Core Capabilities:
${form.core_capabilities}

Past Performance:
${form.past_performance}

Key Differentiators:
${form.differentiators}

Key Personnel:
${teamPersonnel}

Format as clean HTML with proper sections: Company Overview, Core Capabilities, Past Performance, Certifications & Government Registrations, Key Differentiators, Key Personnel, and Contact Information. Use <h2> for major sections, <p> for content.`
        }]
      });
      setCapabilityText(res.data.reply);
      setShowCapabilityModal(true);
      toast.addToast('Capability statement generated', 'success');
    } catch (err) {
      console.error('Generation failed:', err);
      toast.addToast('Failed to generate capability statement', 'error');
    } finally {
      setGeneratingCapability(false);
    }
  };

  const copyCapabilityToClipboard = () => {
    const text = new DOMParser().parseFromString(capabilityText, 'text/html').body.innerText;
    navigator.clipboard.writeText(text).then(() => {
      toast.addToast('Copied to clipboard', 'success');
    });
  };

  const printCapability = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(capabilityText);
    printWindow.document.close();
    printWindow.print();
  };

  const save = async () => {
    setLoading(true); setStatus('');
    try {
      const payload = { ...form };
      if (useCustomTone && form.custom_tone) payload.tone = 'custom';
      payload.certifications = JSON.stringify(form.certifications);
      payload.team_members = JSON.stringify(form.team_members);
      await api.post('/profile', payload);
      setStatus('saved');
      toast.addToast('Profile saved', 'success');
    } catch (err) {
      setStatus('error');
      toast.addToast('Failed to save profile — try again', 'error');
    } finally { setLoading(false); }
  };

  const LoadingCard = () => (
    <div style={s.card}>
      <div style={{ ...s.skeleton, ...s.skeletonLine, width: '30%', marginBottom: 12 }} />
      <div style={{ ...s.skeleton, ...s.skeletonInput, width: '100%' }} />
      <div style={{ ...s.skeleton, ...s.skeletonInput, width: '100%' }} />
    </div>
  );

  return (
    <Layout>
      <style>{`
        input, textarea, select {
          background: var(--bg2);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 10px 12px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 13px;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-bg);
        }
        input::placeholder, textarea::placeholder {
          color: var(--text3);
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
      <div style={s.page}>
        <div style={s.heading}>Company Profile</div>
        <div style={s.sub}>Controls who you are and how you sound. The GovCon knowledge is built into the AI — you just set your name, role, and tone.</div>

        {status === 'load-error' ? (
          <div style={{ ...s.card, background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            Failed to load profile. Please refresh the page or try again.
          </div>
        ) : null}

        {/* Auto-fill */}
        {loading ? <LoadingCard /> : (
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
          {status === 'autofill-error' && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Could not read website — fill in manually below</div>}
        </div>
        )}

        {/* Profile Completeness Meter */}
        {!loading && (
        <div style={s.card}>
          <div style={s.cardTitle}>Profile Completeness</div>
          <div style={s.divider} />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{calculateCompleteness()}%</div>
          <div style={s.progressBar}>
            <div style={s.progressFill(calculateCompleteness())} />
          </div>
          {getMissingItems().length > 0 && (
            <div style={s.progressLabel}>
              <strong>Missing:</strong> {getMissingItems().slice(0, 3).join(', ')}{getMissingItems().length > 3 ? ` (+${getMissingItems().length - 3} more)` : ''}
            </div>
          )}
        </div>
        )}

        {/* Company Info Section */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Company Information</div>
          <div style={s.divider} />
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Company Name</label>
              <input value={form.name} onChange={set('name')} placeholder="Your company name" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Website</label>
              <input value={form.website_url} onChange={set('website_url')} placeholder="https://example.com" />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Phone</label>
              <input value={form.company_phone} onChange={set('company_phone')} placeholder="(555) 123-4567" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input value={form.company_email} onChange={set('company_email')} placeholder="contact@company.com" type="email" />
            </div>
          </div>
          <div style={s.rowSingle}>
            <div style={s.field}>
              <label style={s.label}>Address</label>
              <input value={form.company_address} onChange={set('company_address')} placeholder="123 Main Street, Suite 100, City, State 12345" />
            </div>
          </div>
        </div>
        )}

        {/* Government Registration */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Government Registration</div>
          <div style={s.divider} />
          <div style={s.row3}>
            <div style={s.field}>
              <label style={s.label}>CAGE Code</label>
              <input value={form.cage_code} onChange={set('cage_code')} placeholder="e.g., 1A2B3" />
            </div>
            <div style={s.field}>
              <label style={s.label}>UEI</label>
              <input value={form.uei} onChange={set('uei')} placeholder="Unique Entity ID" />
            </div>
            <div style={s.field}>
              <label style={s.label}>DUNS Number</label>
              <input value={form.duns} onChange={set('duns')} placeholder="123456789" />
            </div>
          </div>
        </div>
        )}

        {/* NAICS Codes */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>NAICS Codes</div>
          <div style={s.cardSub}>Comma-separated list of all applicable NAICS codes</div>
          <div style={s.divider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <input value={form.naics_codes} onChange={set('naics_codes')} placeholder="541511, 541512, 611430" />
              <span style={s.hint}>Include all codes your company is registered under</span>
            </div>
          </div>
        </div>
        )}

        {/* Certifications */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Certifications & Set-Asides</div>
          <div style={s.divider} />
          <div style={s.certGrid}>
            {CERTIFICATIONS.map(cert => (
              <div key={cert.value} style={s.certBox}>
                <input
                  type="checkbox"
                  id={`cert-${cert.value}`}
                  checked={form.certifications.includes(cert.value)}
                  onChange={() => toggleCertification(cert.value)}
                  style={s.certCheckbox}
                />
                <label htmlFor={`cert-${cert.value}`} style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: 0 }}>
                  {cert.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Core Capabilities */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Core Capabilities</div>
          <div style={s.cardSub}>What your company does best — will be used in the capability statement</div>
          <div style={s.divider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <textarea value={form.core_capabilities} onChange={set('core_capabilities')}
                placeholder="e.g., Cybersecurity consulting, Systems integration, Cloud infrastructure deployment..."
                style={{ minHeight: 100 }} />
              <span style={s.hint}>One per line or comma-separated</span>
            </div>
          </div>
        </div>
        )}

        {/* Past Performance */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Past Performance</div>
          <div style={s.cardSub}>Recent contracts and relevant examples</div>
          <div style={s.divider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <textarea value={form.past_performance} onChange={set('past_performance')}
                placeholder="e.g., Delivered secure network infrastructure for Department of Defense contract, 2023-2024..."
                style={{ minHeight: 100 }} />
              <span style={s.hint}>Include contract values, agencies, and dates when possible</span>
            </div>
          </div>
        </div>
        )}

        {/* Differentiators */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Key Differentiators</div>
          <div style={s.cardSub}>What makes your company unique and competitive</div>
          <div style={s.divider} />
          <div style={s.rowSingle}>
            <div style={s.field}>
              <textarea value={form.differentiators} onChange={set('differentiators')}
                placeholder="e.g., 20+ years of federal compliance experience, ISO 27001 certified, FAR compliant processes..."
                style={{ minHeight: 100 }} />
            </div>
          </div>
        </div>
        )}

        {/* Team / Key Personnel */}
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>Key Personnel</div>
          <div style={s.cardSub}>Add team members who will be visible in your capability statement</div>
          <div style={s.divider} />
          {form.team_members.map((member, idx) => (
            <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < form.team_members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Name</label>
                  <input value={member.name} onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                    placeholder="John Smith" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Title</label>
                  <input value={member.title} onChange={(e) => updateTeamMember(idx, 'title', e.target.value)}
                    placeholder="Program Director" />
                </div>
              </div>
              <button style={{ ...s.autoFillBtn, background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                onClick={() => removeTeamMember(idx)}>
                Remove
              </button>
            </div>
          ))}
          <button style={s.autoFillBtn} onClick={addTeamMember}>+ Add Team Member</button>
        </div>
        )}

        {/* Who you are */}
        {loading ? <LoadingCard /> : (
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
        )}

        {/* What you sell — admin only */}
        {isAdmin && (loading ? <LoadingCard /> : <div style={s.card}>
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
        </div>)}

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
        {loading ? <LoadingCard /> : (
        <div style={s.card}>
          <div style={s.cardTitle}>🔒 Built-in GovCon intelligence</div>
          <div style={s.cardSub}>This knowledge is locked into the AI — it does not need to live in a form.</div>
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
        )}

        {/* Tone */}
        {loading ? <LoadingCard /> : (
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
        )}

        {loading ? <LoadingCard /> : (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={s.cardTitle}>Email Signature</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Appended to every email generated. Include your name, title, phone, LinkedIn — whatever you want prospects to see.</div>
          <textarea value={form.email_signature} onChange={set('email_signature')}
            placeholder={`Jack Beaver\nAccount Executive — SumX AI\n(434) 555-0100\nlinkedin.com/in/jackbeaver`}
            style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 13, width: '100%' }} />
        </div>
        )}

        {/* Capability Statement Generator */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: '2rem' }}>
          <button style={s.saveBtn} onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
          <button style={s.secondaryBtn} onClick={generateCapabilityStatement} disabled={generatingCapability || calculateCompleteness() < 50}>
            {generatingCapability ? 'Generating...' : 'Generate Capability Statement'}
          </button>
          {status === 'saved' && <span style={s.success}>✓ Saved</span>}
          {status === 'error' && <span style={s.err}>Failed to save — try again</span>}
          {status === 'load-error' && <span style={s.err}>Failed to load profile — showing defaults</span>}
        </div>
      </div>

      <Modal isOpen={showCapabilityModal} onClose={() => setShowCapabilityModal(false)} title="Capability Statement">
        <div style={s.capabilityHtml} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(capabilityText) }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button style={s.saveBtn} onClick={copyCapabilityToClipboard}>Copy to Clipboard</button>
          <button style={s.secondaryBtn} onClick={printCapability}>Print</button>
          <button style={s.secondaryBtn} onClick={() => setShowCapabilityModal(false)}>Close</button>
        </div>
      </Modal>
    </Layout>
  );
}


