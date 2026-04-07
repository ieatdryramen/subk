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
  page: { padding: '2rem 2.5rem', maxWidth: 800 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  saveBtn: { padding: '11px 28px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
  successMsg: { padding: '10px 14px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16 },
  certGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  certBtn: (active) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'var(--bg3)', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }),
  uploadZone: (dragging) => ({ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--accent-bg)' : 'var(--bg3)', transition: 'all 0.15s' }),
};

export default function ProfilePage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    company_name: '', website_url: '', naics_codes: '', cage_code: '', uei: '',
    certifications: '', past_performance: '', capabilities: '', target_agencies: '',
    contract_min: 50000, contract_max: 5000000, set_aside_prefs: '', state: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [ueiLooking, setUeiLooking] = useState(false);
  const [ueiMsg, setUeiMsg] = useState('');
  const [ueiData, setUeiData] = useState(null);
  const [pastPerf, setPastPerf] = useState([]);
  const [ppModal, setPpModal] = useState(null); // null | 'new' | record
  const [ppForm, setPpForm] = useState({ contract_number: '', contract_title: '', agency: '', prime_or_sub: 'prime', award_amount: '', period_start: '', period_end: '', naics_code: '', set_aside: '', description: '', relevance_tags: '' });
  const [ppSaving, setPpSaving] = useState(false);
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
        }
      }).catch(() => {}),
      api.get('/sub-profile/past-performance').then(r => setPastPerf(r.data || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

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
      // Auto-fill form from SAM data
      if (d.sam) {
        setForm(f => ({
          ...f,
          company_name: d.sam.legalName || f.company_name,
          cage_code: d.sam.cageCode || f.cage_code,
          naics_codes: d.sam.naicsList || d.sam.naicsCode || f.naics_codes,
          state: d.sam.state || f.state,
          website_url: d.sam.website || f.website_url,
        }));
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
    } finally { setUeiLooking(false); }
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

  const toggleCert = (cert) => {
    const next = selectedCerts.includes(cert)
      ? selectedCerts.filter(c => c !== cert)
      : [...selectedCerts, cert];
    setSelectedCerts(next);
    setForm(f => ({ ...f, certifications: next.join(', ') }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/sub-profile', { ...form, certifications: selectedCerts.join(', ') });
      setSaved(true);
      showToast('Profile saved successfully', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to save profile';
      showToast(errorMsg, 'error');
    } finally { setSaving(false); }
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

      // Merge extracted data into form — only overwrite non-empty fields
      setForm(f => ({
        ...f,
        company_name: extracted.company_name || f.company_name,
        cage_code: extracted.cage_code || f.cage_code,
        uei: extracted.uei || f.uei,
        naics_codes: extracted.naics_codes || f.naics_codes,
        capabilities: extracted.capabilities || f.capabilities,
        past_performance: extracted.past_performance || f.past_performance,
        target_agencies: extracted.target_agencies || f.target_agencies,
        website_url: extracted.website_url || f.website_url,
        state: extracted.state || f.state,
        contract_min: extracted.contract_min || f.contract_min,
        contract_max: extracted.contract_max || f.contract_max,
      }));

      // Merge certifications
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
    } finally { setParsing(false); }
  };

  const savePP = async () => {
    setPpSaving(true);
    try {
      if (ppModal === 'new') {
        const r = await api.post('/sub-profile/past-performance', ppForm);
        setPastPerf(p => [r.data, ...p]);
      } else {
        const r = await api.put(`/profile/past-performance/${ppModal.id}`, ppForm);
        setPastPerf(p => p.map(x => x.id === ppModal.id ? r.data : x));
      }
      setPpModal(null);
      setPpForm({ contract_number: '', contract_title: '', agency: '', prime_or_sub: 'prime', award_amount: '', period_start: '', period_end: '', naics_code: '', set_aside: '', description: '', relevance_tags: '' });
      showToast('Past performance record saved', 'success');
    } catch (e) {
      const errorMsg = e.response?.data?.error || 'Failed to save record';
      showToast(errorMsg, 'error');
    }
    finally { setPpSaving(false); }
  };

  const deletePP = async (id) => {
    if (!confirm('Delete this record?')) return;
    await api.delete(`/profile/past-performance/${id}`).catch(() => {});
    setPastPerf(p => p.filter(x => x.id !== id));
  };

  const openPP = (record) => {
    setPpForm({ ...record, award_amount: record.award_amount || '', period_start: record.period_start?.split('T')[0] || '', period_end: record.period_end?.split('T')[0] || '' });
    setPpModal(record);
  };

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
  const pf = (key) => ({ value: ppForm[key] || '', onChange: e => setPpForm(p => ({ ...p, [key]: e.target.value })) });

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
            <div style={s.heading}>Subcontractor Profile</div>
            <div style={s.sub}>Your capabilities, certs, and past performance power opportunity scoring and teaming matches</div>
          </>
        )}

        {saved && <div style={s.successMsg}>✓ Profile saved successfully</div>}

        {!loading && (
        <>
        {/* Cap Statement Upload */}
        <div style={s.section}>
          <div style={s.sectionTitle}>📄 Auto-fill from Capability Statement</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            Upload your cap statement PDF and we'll extract your company info, NAICS codes, certifications, and capabilities automatically.
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

        {/* Company Info */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Company Information</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Company Name *</label>
              <input {...f('company_name')} placeholder="Apex Defense Solutions LLC" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Website</label>
              <input {...f('website_url')} placeholder="https://apexdefense.com" />
            </div>
            <div style={s.field}>
              <label style={s.label}>CAGE Code</label>
              <input {...f('cage_code')} placeholder="7XYZ1" />
            </div>
            <div style={s.field}>
              <label style={s.label}>State</label>
              <input {...f('state')} placeholder="VA" />
            </div>
          </div>

          {/* UEI auto-populate */}
          <div style={{ marginTop: 8, padding: '1rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <label style={s.label}>UEI — Auto-populate from SAM.gov</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input {...f('uei')} placeholder="ABCDEF123456789" style={{ flex: 1 }} />
              <button onClick={lookupUEI} disabled={!form.uei?.trim() || ueiLooking}
                style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, opacity: ueiLooking ? 0.7 : 1 }}>
                {ueiLooking ? '⏳ Looking up...' : '🔍 Lookup UEI'}
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
                  Found {ueiData.awards.length} contracts from USASpending — import as past performance records?
                </div>
                <button onClick={importAwards}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  ↓ Import {ueiData.awards.length} Award Records
                </button>
                <div style={{ marginTop: 8, maxHeight: 140, overflowY: 'auto' }}>
                  {ueiData.awards.slice(0, 5).map((a, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      {a.agency} · ${a.amount ? (a.amount / 1e6).toFixed(2) + 'M' : 'N/A'} · {a.startDate?.split('T')[0] || ''}
                    </div>
                  ))}
                  {ueiData.awards.length > 5 && <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>+{ueiData.awards.length - 5} more</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NAICS Codes */}
        <div style={s.section}>
          <div style={s.sectionTitle}>NAICS Codes</div>
          <div style={s.field}>
            <label style={s.label}>Primary NAICS codes (comma separated)</label>
            <input {...f('naics_codes')} placeholder="541512, 541511, 541330" />
            <div style={s.hint}>These are used to match opportunities and find relevant prime awardees</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {COMMON_NAICS.map(n => {
              const code = n.split(' - ')[0];
              const active = (form.naics_codes || '').includes(code);
              return (
                <button key={code} style={s.certBtn(active)} onClick={() => {
                  const codes = (form.naics_codes || '').split(',').map(c => c.trim()).filter(Boolean);
                  const next = active ? codes.filter(c => c !== code) : [...codes, code];
                  setForm(p => ({ ...p, naics_codes: next.join(', ') }));
                }}>
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Certifications */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Certifications & Set-Asides</div>
          <label style={s.label}>Select all that apply</label>
          <div style={s.certGrid}>
            {SET_ASIDES.map(cert => (
              <button key={cert} style={s.certBtn(selectedCerts.includes(cert))} onClick={() => toggleCert(cert)}>
                {cert}
              </button>
            ))}
          </div>
          <div style={s.hint}>These determine which set-aside opportunities you qualify for</div>
        </div>

        {/* Capabilities & Past Performance */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Capabilities & Past Performance</div>
          <div style={s.field}>
            <label style={s.label}>Core Capabilities *</label>
            <textarea {...f('capabilities')} placeholder="Cybersecurity operations, cloud migration, DevSecOps, software development, network engineering..." style={{ minHeight: 100 }} />
            <div style={s.hint}>Be specific — this is what the AI uses to score opportunities and write outreach</div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Target Agencies</label>
            <input {...f('target_agencies')} placeholder="DoD, DHS, VA, HHS, IC Community" />
          </div>

          {/* Structured Past Performance Records */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Past Performance Records ({pastPerf.length})</div>
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
        </div>

        {/* Contract Range */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Contract Preferences</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Minimum Contract Value ($)</label>
              <input type="number" {...f('contract_min')} placeholder="50000" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Maximum Contract Value ($)</label>
              <input type="number" {...f('contract_max')} placeholder="10000000" />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Preferred Set-Aside Types</label>
            <input {...f('set_aside_prefs')} placeholder="Small Business, 8(a), HUBZone" />
          </div>
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>🌐 Marketplace Visibility</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>List my firm in the Sub Directory</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Allow primes to find your firm and send teaming requests</div>
            </div>
            <button onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
              style={{ padding: '6px 16px', fontSize: 13, fontWeight: 500, borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', background: form.is_public ? 'var(--success-bg)' : 'var(--bg3)', color: form.is_public ? 'var(--success)' : 'var(--text2)' }}>
              {form.is_public ? '✓ Public' : 'Private'}
            </button>
          </div>
          {form.is_public && (
            <div style={{ marginTop: 12 }}>
              <label style={s.label}>Tagline (shows in directory)</label>
              <input value={form.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="SDVOSB · Cybersecurity & Cloud · DoD/IC focused" />
              {form.id && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <label style={{ ...s.label, marginBottom: 4 }}>Shareable Vetting Card URL</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input readOnly value={`${window.location.origin}/sub/${form.id}`}
                      style={{ flex: 1, fontSize: 12, background: 'var(--bg)', color: 'var(--accent2)' }}
                      onClick={e => { e.target.select(); navigator.clipboard.writeText(e.target.value).catch(() => {}); }} />
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/sub/${form.id}`).catch(() => {}); }}
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer', flexShrink: 0 }}>
                      Copy Link
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Send this to primes — no login required to view your profile</div>
                </div>
              )}
            </div>
          )}
        </div>
        <button style={s.saveBtn} onClick={save} disabled={saving || !form.company_name}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        </>
        )}
      </div>

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
                <input {...pf('contract_title')} placeholder="Cybersecurity Support Services" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Contract Number</label>
                <input {...pf('contract_number')} placeholder="N00039-21-C-0001" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Agency</label>
                <input {...pf('agency')} placeholder="Department of Navy" />
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
                <input type="number" {...pf('award_amount')} placeholder="2500000" />
              </div>
              <div style={s.field}>
                <label style={s.label}>NAICS Code</label>
                <input {...pf('naics_code')} placeholder="541512" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Period Start</label>
                <input type="date" {...pf('period_start')} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Period End</label>
                <input type="date" {...pf('period_end')} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Description</label>
              <textarea {...pf('description')} placeholder="Describe the work performed, scope, outcomes, and relevance to your target market..." style={{ minHeight: 80 }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Relevance Tags</label>
              <input {...pf('relevance_tags')} placeholder="cybersecurity, cloud, DoD, zero trust" />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Used to match this record to opportunities</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setPpModal(null)} style={{ padding: '8px 18px', fontSize: 13, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={savePP} disabled={ppSaving} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', opacity: ppSaving ? 0.7 : 1 }}>
                {ppSaving ? 'Saving...' : ppModal === 'new' ? 'Add Record' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
