import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const SET_ASIDES = ['Small Business', '8(a)', 'HUBZone', 'SDVOSB', 'VOSB', 'WOSB', 'EDWOSB', 'SDB'];
const COMMON_NAICS = [
  '541512 - Computer Systems Design', '541511 - Custom Computer Programming',
  '541330 - Engineering Services', '541690 - Other Scientific/Technical Consulting',
  '541611 - Management Consulting', '541519 - Other Computer Related Services',
  '561210 - Facilities Support Services', '238 - Construction',
  '334 - Computer & Electronic Manufacturing', '611 - Educational Services',
];

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  saveBtn: { padding: '11px 28px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
  successMsg: { padding: '10px 14px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16 },
  certGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  certBtn: (active) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'var(--bg3)', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }),
  uploadZone: (dragging) => ({ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--accent-bg)' : 'var(--bg3)', transition: 'all 0.15s' }),
  chip: { display: 'inline-block', padding: '6px 12px', background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', fontSize: 12, marginRight: 6, marginBottom: 6 },
  chipBtn: { background: 'none', border: 'none', padding: 0, color: 'var(--text2)', cursor: 'pointer', fontSize: 12, marginLeft: 4 },
};

export default function SubProfilePage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    company_name: '',
    tagline: '',
    company_description: '',
    founded_year: '',
    employee_count: '',
    annual_revenue: '',
    location: '',
    website_url: '',
    phone: '',
    email: '',
    naics_codes: '',
    certifications: '',
    cage_code: '',
    uei: '',
    capabilities: '',
    differentiators: '',
    target_agencies: '',
    contract_min: 50000,
    contract_max: 5000000,
    set_aside_prefs: '',
    state: '',
    is_public: false,
  });

  const [naicsList, setNaicsList] = useState([]);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [keyPersonnel, setKeyPersonnel] = useState([]);
  const [pastPerf, setPastPerf] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [ueiLooking, setUeiLooking] = useState(false);
  const [ueiMsg, setUeiMsg] = useState('');
  const [ueiData, setUeiData] = useState(null);

  const [capStmtModal, setCapStmtModal] = useState(false);
  const [capStmtHtml, setCapStmtHtml] = useState('');
  const [capStmtLoading, setCapStmtLoading] = useState(false);

  const [ppModal, setPpModal] = useState(null);
  const [ppForm, setPpForm] = useState({ contract_number: '', contract_title: '', agency: '', prime_or_sub: 'prime', award_amount: '', period_start: '', period_end: '', naics_code: '', set_aside: '', description: '', relevance_tags: '' });
  const [ppSaving, setPpSaving] = useState(false);

  const [kpModal, setKpModal] = useState(null);
  const [kpForm, setKpForm] = useState({ name: '', title: '', clearance: '', bio: '' });
  const [kpSaving, setKpSaving] = useState(false);

  const fileRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/sub-profile').then(r => {
        if (r.data) {
          setForm(f => ({ ...f, ...r.data }));
          if (r.data.certifications) {
            setSelectedCerts(r.data.certifications.split(',').map(c => c.trim()).filter(Boolean));
          }
          if (r.data.naics_codes) {
            setNaicsList(r.data.naics_codes.split(',').map(c => c.trim()).filter(Boolean));
          }
          if (r.data.key_personnel) {
            try {
              setKeyPersonnel(JSON.parse(r.data.key_personnel));
            } catch (e) {
              setKeyPersonnel([]);
            }
          }
        }
      }).catch(() => {}),
      api.get('/sub-profile/past-performance').then(r => setPastPerf(r.data || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const calcCompleteness = () => {
    const fields = [
      form.company_name,
      form.company_description,
      form.capabilities,
      form.differentiators,
      selectedCerts.length > 0,
      naicsList.length > 0,
      form.phone,
      form.email,
    ];
    const filled = fields.filter(f => Boolean(f)).length;
    return Math.round((filled / fields.length) * 100);
  };

  const lookupUEI = async () => {
    const uei = form.uei?.trim();
    if (!uei) return;
    setUeiLooking(true);
    setUeiMsg('Looking up UEI in SAM.gov and USASpending...');
    setUeiData(null);
    try {
      const r = await api.post('/sub-profile/lookup-uei', { uei });
      const d = r.data;
      setUeiData(d);
      if (d.sam) {
        setForm(f => ({
          ...f,
          company_name: d.sam.legalName || f.company_name,
          cage_code: d.sam.cageCode || f.cage_code,
          state: d.sam.state || f.state,
          website_url: d.sam.website || f.website_url,
        }));
        const newNaics = d.sam.naicsList || d.sam.naicsCode || '';
        if (newNaics) {
          const codes = newNaics.split(',').map(c => c.trim()).filter(Boolean);
          const merged = [...new Set([...naicsList, ...codes])];
          setNaicsList(merged);
          setForm(f => ({ ...f, naics_codes: merged.join(', ') }));
        }
        if (d.sam.certifications) {
          const newCerts = d.sam.certifications.split(',').map(c => c.trim()).filter(Boolean);
          const merged = [...new Set([...selectedCerts, ...newCerts])];
          setSelectedCerts(merged);
          setForm(f => ({ ...f, certifications: merged.join(', ') }));
        }
      }
      const lines = [];
      if (d.sam) lines.push(`✓ SAM.gov: ${d.sam.legalName} · CAGE ${d.sam.cageCode} · ${d.sam.registrationStatus}`);
      if (d.awardCount > 0) lines.push(`✓ USASpending: ${d.awardCount} awards · $${(d.totalAwardsValue / 1e6).toFixed(1)}M total`);
      if (!d.sam && d.awardCount === 0) lines.push('No SAM.gov registration or award history found for this UEI.');
      setUeiMsg(lines.join('\n'));
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setUeiMsg('Lookup failed: ' + errorMsg);
      showToast('Lookup failed: ' + errorMsg, 'error');
    } finally {
      setUeiLooking(false);
    }
  };

  const importAwards = async () => {
    if (!ueiData?.awards?.length) return;
    try {
      await api.post('/sub-profile/import-awards', { awards: ueiData.awards });
      const r = await api.get('/sub-profile/past-performance');
      setPastPerf(r.data || []);
      setUeiMsg(prev => prev + '\n✓ Awards imported to past performance.');
      showToast('Awards imported successfully', 'success');
    } catch (e) {
      showToast('Import failed: ' + (e.response?.data?.error || e.message), 'error');
    }
  };

  const parseCapStatement = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setParseMsg('Please upload a PDF file.');
      return;
    }
    setParsing(true);
    setParseMsg('Reading your capability statement...');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const r = await api.post('/sub-profile/parse-capstatement', { pdf_base64: base64, filename: file.name });
      const extracted = r.data.extracted;

      setForm(f => ({
        ...f,
        company_name: extracted.company_name || f.company_name,
        cage_code: extracted.cage_code || f.cage_code,
        uei: extracted.uei || f.uei,
        capabilities: extracted.capabilities || f.capabilities,
        target_agencies: extracted.target_agencies || f.target_agencies,
        website_url: extracted.website_url || f.website_url,
        state: extracted.state || f.state,
      }));

      if (extracted.naics_codes) {
        const codes = extracted.naics_codes.split(',').map(c => c.trim()).filter(Boolean);
        const merged = [...new Set([...naicsList, ...codes])];
        setNaicsList(merged);
        setForm(f => ({ ...f, naics_codes: merged.join(', ') }));
      }

      if (extracted.certifications) {
        const newCerts = extracted.certifications.split(',').map(c => c.trim()).filter(Boolean);
        const merged = [...new Set([...selectedCerts, ...newCerts])];
        setSelectedCerts(merged);
        setForm(f => ({ ...f, certifications: merged.join(', ') }));
      }

      setParseMsg('✓ Capability statement parsed — review the fields below and save.');
      showToast('Capability statement parsed successfully', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setParseMsg('Failed to parse: ' + errorMsg);
      showToast('Failed to parse: ' + errorMsg, 'error');
    } finally {
      setParsing(false);
    }
  };

  const addNaics = (code) => {
    if (!naicsList.includes(code)) {
      setNaicsList([...naicsList, code]);
      setForm(f => ({ ...f, naics_codes: [...naicsList, code].join(', ') }));
    }
  };

  const removeNaics = (code) => {
    const next = naicsList.filter(c => c !== code);
    setNaicsList(next);
    setForm(f => ({ ...f, naics_codes: next.join(', ') }));
  };

  const toggleCert = (cert) => {
    const next = selectedCerts.includes(cert)
      ? selectedCerts.filter(c => c !== cert)
      : [...selectedCerts, cert];
    setSelectedCerts(next);
    setForm(f => ({ ...f, certifications: next.join(', ') }));
  };

  const addKeyPersonnel = () => {
    const newPerson = { id: Date.now(), ...kpForm };
    setKeyPersonnel([...keyPersonnel, newPerson]);
    setKpForm({ name: '', title: '', clearance: '', bio: '' });
    setKpModal(null);
  };

  const removeKeyPersonnel = (id) => {
    setKeyPersonnel(keyPersonnel.filter(p => p.id !== id));
  };

  const generateCapStmt = async () => {
    setCapStmtLoading(true);
    try {
      const r = await api.post('/profile/generate-capstmt');
      setCapStmtHtml(r.data.html);
      setCapStmtModal(true);
    } catch (err) {
      showToast('Failed to generate capability statement: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCapStmtLoading(false);
    }
  };

  const copyCapStmt = () => {
    navigator.clipboard.writeText(capStmtHtml).catch(() => {});
    showToast('HTML copied to clipboard', 'success');
  };

  const printCapStmt = () => {
    const w = window.open('', '', 'width=900,height=1000');
    w.document.write(capStmtHtml);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const shareProfile = async () => {
    try {
      const r = await api.post('/profile/share');
      navigator.clipboard.writeText(r.data.shareUrl).catch(() => {});
      showToast('Link copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to generate share link: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const savePP = async () => {
    setPpSaving(true);
    try {
      if (ppModal === 'new') {
        const r = await api.post('/sub-profile/past-performance', ppForm);
        setPastPerf(p => [r.data, ...p]);
      } else {
        const r = await api.put(`/sub-profile/past-performance/${ppModal.id}`, ppForm);
        setPastPerf(p => p.map(x => x.id === ppModal.id ? r.data : x));
      }
      setPpModal(null);
      setPpForm({ contract_number: '', contract_title: '', agency: '', prime_or_sub: 'prime', award_amount: '', period_start: '', period_end: '', naics_code: '', set_aside: '', description: '', relevance_tags: '' });
      showToast('Past performance record saved', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to save record', 'error');
    } finally {
      setPpSaving(false);
    }
  };

  const deletePP = async (id) => {
    if (!confirm('Delete this record?')) return;
    await api.delete(`/sub-profile/past-performance/${id}`).catch(() => {});
    setPastPerf(p => p.filter(x => x.id !== id));
  };

  const openPP = (record) => {
    setPpForm({ ...record, award_amount: record.award_amount || '', period_start: record.period_start?.split('T')[0] || '', period_end: record.period_end?.split('T')[0] || '' });
    setPpModal(record);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/sub-profile', {
        ...form,
        certifications: selectedCerts.join(', '),
        naics_codes: naicsList.join(', '),
        key_personnel: JSON.stringify(keyPersonnel),
      });
      setSaved(true);
      showToast('Profile saved successfully', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
  const pf = (key) => ({ value: ppForm[key] || '', onChange: e => setPpForm(p => ({ ...p, [key]: e.target.value })) });
  const kf = (key) => ({ value: kpForm[key] || '', onChange: e => setKpForm(p => ({ ...p, [key]: e.target.value })) });

  const completeness = calcCompleteness();

  return (
    <Layout>
      <div style={s.page}>
        {loading && (
          <div style={{ marginBottom: '2rem' }}>
            <div className="pf-skeleton" style={{ height: 32, marginBottom: 16, width: '40%' }} />
            <div className="pf-skeleton" style={{ height: 20, marginBottom: 24, width: '80%' }} />
            <div className="pf-skeleton" style={{ height: 200, marginBottom: 16 }} />
            <div className="pf-skeleton" style={{ height: 200 }} />
          </div>
        )}
        {!loading && (
          <>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={s.heading}>{form.company_name || 'Subcontractor Profile'}</div>
              {form.tagline && <div style={s.sub}>{form.tagline}</div>}

              {/* Completeness Bar */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Profile Completeness</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{completeness}%</div>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', height: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--accent)', height: '100%', width: `${completeness}%`, transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
                <button onClick={generateCapStmt} disabled={capStmtLoading} style={{ padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: capStmtLoading ? 0.7 : 1 }}>
                  {capStmtLoading ? '⏳ Generating...' : '📄 Generate Cap Statement'}
                </button>
                <button onClick={shareProfile} style={{ padding: '10px 18px', background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  🔗 Share Profile
                </button>
              </div>
            </div>

            {saved && <div style={s.successMsg}>✓ Profile saved successfully</div>}

            {/* Upload Cap Statement */}
            <div style={s.section}>
              <div style={s.sectionTitle}>📄 Auto-fill from Capability Statement</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                Upload your cap statement PDF and we'll extract your company info, NAICS codes, and certifications automatically.
              </p>
              <div
                style={s.uploadZone(dragging)}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); parseCapStatement(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                {parsing ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
                    <div style={{ fontSize: 14, color: 'var(--text2)' }}>{parseMsg}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop your capability statement PDF here</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>or click to browse · PDF only</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) parseCapStatement(e.target.files[0]); }} />
              {parseMsg && !parsing && (
                <div style={{ marginTop: 10, fontSize: 13, color: parseMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)', padding: '8px 12px', background: parseMsg.startsWith('✓') ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 'var(--radius)', border: `1px solid ${parseMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)'}` }}>
                  {parseMsg}
                </div>
              )}
            </div>

            {/* Profile Header */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Company Information</div>
              <div style={s.field}>
                <label style={s.label}>Company Name *</label>
                <input {...f('company_name')} placeholder="Apex Defense Solutions LLC" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Tagline (for directory)</label>
                  <input {...f('tagline')} placeholder="SDVOSB · Cybersecurity & Cloud · DoD focused" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Website</label>
                  <input {...f('website_url')} placeholder="https://apexdefense.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </div>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Phone</label>
                  <input {...f('phone')} placeholder="+1 (555) 123-4567" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Email</label>
                  <input {...f('email')} type="email" placeholder="contact@company.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Location</label>
                  <input {...f('location')} placeholder="Arlington, VA" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </div>
            </div>

            {/* Company Overview */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Company Overview</div>
              <div style={s.field}>
                <label style={s.label}>Company Description</label>
                <textarea {...f('company_description')} placeholder="Brief overview of your company, mission, and focus..." style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', minHeight: 80, fontFamily: 'inherit' }} />
              </div>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Founded</label>
                  <input type="number" {...f('founded_year')} placeholder="2015" min="1900" max={new Date().getFullYear()} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Employee Count</label>
                  <input {...f('employee_count')} placeholder="25-50" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Annual Revenue</label>
                  <input {...f('annual_revenue')} placeholder="$5-10M" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </div>
            </div>

            {/* Identifiers */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Federal Identifiers</div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>CAGE Code</label>
                  <input {...f('cage_code')} placeholder="7XYZ1" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>State</label>
                  <input {...f('state')} placeholder="VA" maxLength="2" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </div>

              <div style={{ marginTop: 8, padding: '1rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <label style={s.label}>UEI — Auto-populate from SAM.gov</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input {...f('uei')} placeholder="ABCDEF123456789" style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                  <button onClick={lookupUEI} disabled={!form.uei?.trim() || ueiLooking}
                    style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, opacity: ueiLooking ? 0.7 : 1 }}>
                    {ueiLooking ? '⏳ Looking up...' : '🔍 Lookup'}
                  </button>
                </div>
                {ueiMsg && (
                  <div style={{ marginTop: 8, fontSize: 12, color: ueiMsg.includes('No ') || ueiMsg.includes('failed') ? 'var(--danger)' : 'var(--success)', whiteSpace: 'pre-line' }}>
                    {ueiMsg}
                  </div>
                )}
                {ueiData?.awards?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                      Found {ueiData.awards.length} contracts — import to past performance?
                    </div>
                    <button onClick={importAwards}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                      ↓ Import {ueiData.awards.length} Records
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* NAICS Codes */}
            <div style={s.section}>
              <div style={s.sectionTitle}>NAICS Codes</div>
              <div style={s.field}>
                <label style={s.label}>Selected NAICS Codes</label>
                <div>
                  {naicsList.map(code => (
                    <div key={code} style={s.chip}>
                      {code}
                      <button style={s.chipBtn} onClick={() => removeNaics(code)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={s.label}>Quick Add</label>
                <div style={s.certGrid}>
                  {COMMON_NAICS.map(n => {
                    const code = n.split(' - ')[0];
                    const active = naicsList.includes(code);
                    return (
                      <button key={code} style={s.certBtn(active)} onClick={() => active ? removeNaics(code) : addNaics(code)}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Set-Aside Certifications */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Certifications & Set-Asides</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {SET_ASIDES.map(cert => (
                  <button
                    key={cert}
                    onClick={() => toggleCert(cert)}
                    style={{
                      padding: '12px 16px',
                      background: selectedCerts.includes(cert) ? 'var(--accent-bg)' : 'var(--bg3)',
                      color: selectedCerts.includes(cert) ? 'var(--accent2)' : 'var(--text2)',
                      border: selectedCerts.includes(cert) ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}>
                    {selectedCerts.includes(cert) ? '✓' : '○'} {cert}
                  </button>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Capabilities & Differentiators</div>
              <div style={s.field}>
                <label style={s.label}>Core Capabilities *</label>
                <textarea {...f('capabilities')} placeholder="Cybersecurity operations, cloud migration, DevSecOps, software development..." style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', minHeight: 100, fontFamily: 'inherit' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Differentiators</label>
                <textarea {...f('differentiators')} placeholder="What makes your company unique? Key advantages, specializations, strategic partnerships..." style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', minHeight: 100, fontFamily: 'inherit' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Target Agencies</label>
                <input {...f('target_agencies')} placeholder="DoD, DHS, VA, HHS, IC Community" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            </div>

            {/* Key Personnel */}
            <div style={s.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={s.sectionTitle}>Key Personnel ({keyPersonnel.length})</div>
                <button onClick={() => { setKpForm({ name: '', title: '', clearance: '', bio: '' }); setKpModal('new'); }}
                  style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  + Add Person
                </button>
              </div>
              {keyPersonnel.length === 0 ? (
                <div style={{ padding: '1rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                  No key personnel added yet
                </div>
              ) : keyPersonnel.map(kp => (
                <div key={kp.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{kp.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {kp.title}{kp.clearance ? ` · ${kp.clearance}` : ''}
                      </div>
                      {kp.bio && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{kp.bio.substring(0, 100)}{kp.bio.length > 100 ? '...' : ''}</div>}
                    </div>
                    <button onClick={() => removeKeyPersonnel(kp.id)} style={{ padding: '3px 8px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Past Performance */}
            <div style={s.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={s.sectionTitle}>Past Performance ({pastPerf.length})</div>
                <button onClick={() => { setPpForm({ contract_number: '', contract_title: '', agency: '', prime_or_sub: 'prime', award_amount: '', period_start: '', period_end: '', naics_code: '', set_aside: '', description: '', relevance_tags: '' }); setPpModal('new'); }}
                  style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  + Add Record
                </button>
              </div>
              {pastPerf.length === 0 ? (
                <div style={{ padding: '1rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                  No past performance records yet. Add manually or import via UEI lookup above.
                </div>
              ) : pastPerf.map(pp => (
                <div key={pp.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{pp.contract_title || pp.contract_number || 'Untitled'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {pp.agency}{pp.award_amount ? ` · $${(pp.award_amount / 1e6).toFixed(2)}M` : ''}
                        {pp.period_start ? ` · ${pp.period_start?.split('T')[0]}` : ''}
                        {pp.period_end ? ` – ${pp.period_end?.split('T')[0]}` : ''}
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 8, fontSize: 10, background: pp.prime_or_sub === 'prime' ? 'var(--accent-bg)' : 'var(--success-bg)', color: pp.prime_or_sub === 'prime' ? 'var(--accent2)' : 'var(--success)' }}>{pp.prime_or_sub}</span>
                      </div>
                      {pp.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{pp.description.substring(0, 100)}{pp.description.length > 100 ? '...' : ''}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button onClick={() => openPP(pp)} style={{ padding: '3px 8px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deletePP(pp.id)} style={{ padding: '3px 8px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contract Preferences */}
            <div style={s.section}>
              <div style={s.sectionTitle}>Contract Preferences</div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Minimum Contract Value ($)</label>
                  <input type="number" {...f('contract_min')} placeholder="50000" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Maximum Contract Value ($)</label>
                  <input type="number" {...f('contract_max')} placeholder="5000000" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Preferred Set-Aside Types</label>
                <input {...f('set_aside_prefs')} placeholder="Small Business, 8(a), HUBZone" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            </div>

            {/* Save Button */}
            <button style={s.saveBtn} onClick={save} disabled={saving || !form.company_name}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </>
        )}
      </div>

      {/* Cap Statement Modal */}
      {capStmtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}
          onClick={() => setCapStmtModal(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 800, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Capability Statement</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyCapStmt} style={{ padding: '8px 14px', fontSize: 13, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  📋 Copy HTML
                </button>
                <button onClick={printCapStmt} style={{ padding: '8px 14px', fontSize: 13, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  🖨️ Print
                </button>
                <button onClick={() => setCapStmtModal(false)} style={{ padding: '8px 14px', fontSize: 13, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{ background: 'white', color: '#333', padding: '1rem', borderRadius: 'var(--radius)', maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--border)' }} dangerouslySetInnerHTML={{ __html: capStmtHtml }} />
          </div>
        </div>
      )}

      {/* Past Performance Modal */}
      {ppModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}
          onClick={() => setPpModal(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1.25rem' }}>
              {ppModal === 'new' ? 'Add Past Performance Record' : 'Edit Past Performance Record'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={s.field}>
                <label style={s.label}>Contract Title</label>
                <input {...pf('contract_title')} placeholder="Cybersecurity Support Services" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Contract Number</label>
                <input {...pf('contract_number')} placeholder="N00039-21-C-0001" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Agency</label>
                <input {...pf('agency')} placeholder="Department of Navy" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select {...pf('prime_or_sub')} style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', width: '100%', fontSize: 14 }}>
                  <option value="prime">Prime Contractor</option>
                  <option value="sub">Subcontractor</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Award Amount ($)</label>
                <input type="number" {...pf('award_amount')} placeholder="2500000" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>NAICS Code</label>
                <input {...pf('naics_code')} placeholder="541512" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Period Start</label>
                <input type="date" {...pf('period_start')} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Period End</label>
                <input type="date" {...pf('period_end')} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Description</label>
              <textarea {...pf('description')} placeholder="Describe the work performed, scope, outcomes, and relevance..." style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', minHeight: 80, fontFamily: 'inherit' }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Relevance Tags</label>
              <input {...pf('relevance_tags')} placeholder="cybersecurity, cloud, DoD, zero trust" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setPpModal(null)} style={{ padding: '8px 18px', fontSize: 13, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={savePP} disabled={ppSaving} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', opacity: ppSaving ? 0.7 : 1 }}>
                {ppSaving ? 'Saving...' : ppModal === 'new' ? 'Add Record' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Personnel Modal */}
      {kpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}
          onClick={() => setKpModal(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1.25rem' }}>
              Add Key Personnel
            </div>
            <div style={s.field}>
              <label style={s.label}>Name</label>
              <input {...kf('name')} placeholder="John Smith" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Title</label>
              <input {...kf('title')} placeholder="Chief Technology Officer" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Clearance</label>
              <select {...kf('clearance')} style={{ width: '100%', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 14 }}>
                <option value="">None</option>
                <option value="Secret">Secret</option>
                <option value="Top Secret">Top Secret</option>
                <option value="Top Secret / SCI">Top Secret / SCI</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Bio / Experience</label>
              <textarea {...kf('bio')} placeholder="Years of experience, key achievements, relevant background..." style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', minHeight: 80, fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setKpModal(null)} style={{ padding: '8px 18px', fontSize: 13, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addKeyPersonnel} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                Add Person
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
