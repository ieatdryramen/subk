import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const COMMON_NAICS = [
  '541512 - Computer Systems Design', '541511 - Custom Computer Programming',
  '541330 - Engineering Services', '541690 - Other Scientific/Technical Consulting',
  '541611 - Management Consulting', '541519 - Other Computer Related Services',
  '561210 - Facilities Support Services', '238 - Construction',
  '334 - Computer & Electronic Manufacturing', '611 - Educational Services',
];

const SET_ASIDES = ['Small Business', '8(a)', 'HUBZone', 'SDVOSB', 'VOSB', 'WOSB', 'EDWOSB', 'SDB'];

const AGENCIES = [
  'Department of Defense', 'Department of Homeland Security', 'Department of Veterans Affairs',
  'General Services Administration', 'Department of Energy', 'Department of Health and Human Services',
  'Department of the Treasury', 'Department of Justice', 'Department of Transportation',
  'Department of Agriculture', 'Intelligence Community', 'NASA', 'EPA',
];

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState(true);
  const fileRef = useRef(null);
  const csvRef = useRef(null);

  // Step 1: Company basics
  const [company, setCompany] = useState({
    company_name: '', website_url: '', cage_code: '', uei: '',
  });

  // Step 2: GovCon profile
  const [profile, setProfile] = useState({
    naics_codes: '', certifications: '',
  });
  const [selectedCerts, setSelectedCerts] = useState([]);

  // Step 3: Preferences
  const [prefs, setPrefs] = useState({
    contract_min: '', contract_max: '',
    keywords: '', target_agencies: [],
  });

  // Step 4: Import contacts
  const [manualLeads, setManualLeads] = useState([{ full_name: '', company: '', title: '', email: '' }]);
  const [csvImported, setCsvImported] = useState(0);
  const [importListId, setImportListId] = useState(null);

  const toggleCert = (cert) => {
    const next = selectedCerts.includes(cert)
      ? selectedCerts.filter(c => c !== cert)
      : [...selectedCerts, cert];
    setSelectedCerts(next);
    setProfile(f => ({ ...f, certifications: next.join(', ') }));
  };

  const toggleAgency = (agency) => {
    setPrefs(p => ({
      ...p,
      target_agencies: p.target_agencies.includes(agency)
        ? p.target_agencies.filter(a => a !== agency)
        : [...p.target_agencies, agency],
    }));
  };

  // Capability statement PDF parsing
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
      const ex = r.data.extracted;
      if (ex.company_name) setCompany(c => ({ ...c, company_name: ex.company_name }));
      if (ex.naics_codes) setProfile(p => ({ ...p, naics_codes: ex.naics_codes }));
      if (ex.certifications) {
        setProfile(p => ({ ...p, certifications: ex.certifications }));
        setSelectedCerts(ex.certifications.split(',').map(c => c.trim()).filter(Boolean));
      }
      if (ex.cage_code) setCompany(c => ({ ...c, cage_code: ex.cage_code }));
      if (ex.uei) setCompany(c => ({ ...c, uei: ex.uei }));
      if (ex.website_url) setCompany(c => ({ ...c, website_url: ex.website_url }));
      setParseMsg(`Extracted: ${ex.company_name || 'company info'}`);
      addToast('Capability statement parsed', 'success');
    } catch (err) {
      setParseMsg('Failed to parse: ' + (err.response?.data?.error || err.message));
    } finally { setParsing(false); }
  };

  // CSV import
  const handleCsvUpload = async (file) => {
    if (!file) return;
    try {
      // Create a list if we don't have one
      let listId = importListId;
      if (!listId) {
        const lr = await api.post('/lists', { name: 'Imported Contacts', description: 'Contacts imported during onboarding' });
        listId = lr.data.id;
        setImportListId(listId);
      }
      const formData = new FormData();
      formData.append('file', file);
      const r = await api.post(`/lists/${listId}/import`, formData);
      setCsvImported(r.data.imported || 0);
      addToast(`Imported ${r.data.imported} contacts`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'CSV import failed', 'error');
    }
  };

  // Save manual leads
  const saveManualLeads = async () => {
    const valid = manualLeads.filter(l => l.full_name || l.email);
    if (valid.length === 0) return;
    try {
      let listId = importListId;
      if (!listId) {
        const lr = await api.post('/lists', { name: 'Imported Contacts', description: 'Contacts imported during onboarding' });
        listId = lr.data.id;
        setImportListId(listId);
      }
      await api.post(`/lists/${listId}/leads`, { leads: valid });
      addToast(`Added ${valid.length} contacts`, 'success');
    } catch (err) {
      addToast('Failed to save contacts', 'error');
    }
  };

  const addManualRow = () => setManualLeads(l => [...l, { full_name: '', company: '', title: '', email: '' }]);
  const updateManualLead = (i, field, val) => setManualLeads(l => l.map((lead, j) => j === i ? { ...lead, [field]: val } : lead));

  // Final save & complete onboarding
  const completeOnboarding = async () => {
    setSaving(true);
    try {
      // Save sub profile
      await api.post('/sub-profile', {
        company_name: company.company_name,
        website_url: company.website_url,
        cage_code: company.cage_code,
        uei: company.uei,
        naics_codes: profile.naics_codes,
        certifications: profile.certifications,
        target_agencies: prefs.target_agencies.join(', '),
        contract_min: prefs.contract_min ? parseInt(prefs.contract_min) : undefined,
        contract_max: prefs.contract_max ? parseInt(prefs.contract_max) : undefined,
      });

      // Mark onboarding complete
      await api.post('/auth/complete-onboarding');

      // Update local user state
      const updatedUser = { ...user, onboarding_complete: true };
      setUser(updatedUser);
      localStorage.setItem('sumx_user', JSON.stringify(updatedUser));

      addToast('Welcome to SumX CRM!', 'success');
      navigate('/dashboard');
    } catch (err) {
      addToast(err.response?.data?.error || 'Setup failed', 'error');
      setSaving(false);
    }
  };

  const goNext = async () => {
    if (step === 4) {
      // Save any manual leads before moving to step 5
      const valid = manualLeads.filter(l => l.full_name || l.email);
      if (valid.length > 0) await saveManualLeads();
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      await completeOnboarding();
    }
  };

  const skip = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const s = {
    container: { padding: '2rem 2.5rem', maxWidth: 700, margin: '0 auto' },
    progressBar: { marginBottom: '2rem', height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' },
    stepNum: { fontSize: 13, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 },
    heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
    section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
    field: { marginBottom: 16 },
    label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' },
    uploadZone: (active) => ({ border: `2px dashed ${active ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'var(--bg3)', transition: 'all 0.15s' }),
    certGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    certBtn: (active) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'var(--bg3)', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }),
    buttons: { display: 'flex', gap: 12, marginTop: '2rem' },
    btn: (primary) => ({ flex: 1, padding: '11px', background: primary ? 'var(--accent)' : 'var(--bg3)', color: primary ? '#fff' : 'var(--text2)', border: primary ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }),
    skipBtn: { padding: '8px 16px', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' },
    tabBtns: { display: 'flex', gap: 10, marginBottom: '1rem' },
    tabBtn: (active) => ({ flex: 1, padding: '8px 12px', background: active ? 'var(--accent-bg)' : 'var(--bg)', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }),
  };

  return (
    <Layout>
      <div style={s.container}>
        <div style={s.progressBar}>
          <div style={s.progressFill} />
        </div>

        {/* Step 1: Company Basics */}
        {step === 1 && (
          <>
            <div style={s.stepNum}>Step 1 of {TOTAL_STEPS}</div>
            <div style={s.heading}>Company Basics</div>
            <div style={s.sub}>Tell us about your company, or upload a capability statement to auto-fill</div>

            <div style={s.section}>
              <div style={s.tabBtns}>
                <button style={s.tabBtn(uploadMode)} onClick={() => setUploadMode(true)}>Upload Cap Statement</button>
                <button style={s.tabBtn(!uploadMode)} onClick={() => setUploadMode(false)}>Enter Manually</button>
              </div>

              {uploadMode && (
                <>
                  <div
                    style={s.uploadZone(dragging)}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); parseCapStatement(e.dataTransfer.files[0]); }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>Drag your capability statement PDF</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>or click to browse</div>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e => e.target.files[0] && parseCapStatement(e.target.files[0])} style={{ display: 'none' }} />
                  {parsing && <div style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Parsing...</div>}
                  {parseMsg && !parsing && <div style={{ padding: '10px 12px', background: parseMsg.includes('Extracted') ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 'var(--radius)', fontSize: 12, marginTop: 8, color: parseMsg.includes('Extracted') ? 'var(--success)' : 'var(--danger)' }}>{parseMsg}</div>}
                  <div style={{ marginTop: 16 }} />
                </>
              )}

              <div style={s.field}>
                <label style={s.label}>Company Name</label>
                <input style={s.input} value={company.company_name} onChange={e => setCompany({ ...company, company_name: e.target.value })} placeholder="Apex Defense Solutions LLC" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Website</label>
                <input style={s.input} value={company.website_url} onChange={e => setCompany({ ...company, website_url: e.target.value })} placeholder="https://yourcompany.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>CAGE Code</label>
                  <input style={s.input} value={company.cage_code} onChange={e => setCompany({ ...company, cage_code: e.target.value })} placeholder="8K7N2" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>UEI</label>
                  <input style={s.input} value={company.uei} onChange={e => setCompany({ ...company, uei: e.target.value })} placeholder="J7K9LM2N3P4Q" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 2: GovCon Profile */}
        {step === 2 && (
          <>
            <div style={s.stepNum}>Step 2 of {TOTAL_STEPS}</div>
            <div style={s.heading}>GovCon Profile</div>
            <div style={s.sub}>NAICS codes, certifications, and set-aside statuses</div>

            <div style={s.section}>
              <div style={s.field}>
                <label style={s.label}>NAICS Codes (comma-separated)</label>
                <input style={s.input} value={profile.naics_codes} onChange={e => setProfile({ ...profile, naics_codes: e.target.value })} placeholder="541512, 541519, 518210" list="naics-list" />
                <datalist id="naics-list">
                  {COMMON_NAICS.map(code => <option key={code} value={code.split(' - ')[0]} />)}
                </datalist>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {COMMON_NAICS.map(code => (
                    <button key={code} style={{ ...s.certBtn(profile.naics_codes.includes(code.split(' - ')[0])), fontSize: 11 }}
                      onClick={() => {
                        const c = code.split(' - ')[0];
                        const current = profile.naics_codes.split(',').map(x => x.trim()).filter(Boolean);
                        const next = current.includes(c) ? current.filter(x => x !== c) : [...current, c];
                        setProfile({ ...profile, naics_codes: next.join(', ') });
                      }}>
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Certifications & Set-Aside Status</label>
                <div style={s.certGrid}>
                  {SET_ASIDES.map(cert => (
                    <button key={cert} style={s.certBtn(selectedCerts.includes(cert))} onClick={() => toggleCert(cert)}>
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <>
            <div style={s.stepNum}>Step 3 of {TOTAL_STEPS}</div>
            <div style={s.heading}>Search Preferences</div>
            <div style={s.sub}>Contract size range, target agencies, and keywords for opportunity matching</div>

            <div style={s.section}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>Min Contract Value ($)</label>
                  <input style={s.input} type="number" value={prefs.contract_min} onChange={e => setPrefs({ ...prefs, contract_min: e.target.value })} placeholder="500000" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Max Contract Value ($)</label>
                  <input style={s.input} type="number" value={prefs.contract_max} onChange={e => setPrefs({ ...prefs, contract_max: e.target.value })} placeholder="25000000" />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Target Agencies</label>
                <div style={s.certGrid}>
                  {AGENCIES.map(agency => (
                    <button key={agency} style={s.certBtn(prefs.target_agencies.includes(agency))} onClick={() => toggleAgency(agency)}>
                      {agency}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Keywords (for opportunity matching)</label>
                <input style={s.input} value={prefs.keywords} onChange={e => setPrefs({ ...prefs, keywords: e.target.value })} placeholder="cloud migration, cybersecurity, DevSecOps, zero trust" />
              </div>
            </div>
          </>
        )}

        {/* Step 4: Import Contacts */}
        {step === 4 && (
          <>
            <div style={s.stepNum}>Step 4 of {TOTAL_STEPS}</div>
            <div style={s.heading}>Import Contacts</div>
            <div style={s.sub}>Add your existing leads via CSV upload or manual entry</div>

            <div style={s.section}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Upload CSV</div>
              <div
                style={s.uploadZone(false)}
                onClick={() => csvRef.current?.click()}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>📊</div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>Drop a CSV file or click to browse</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Supports ZoomInfo, Apollo, HubSpot, and standard CSV exports</div>
              </div>
              <input ref={csvRef} type="file" accept=".csv" onChange={e => e.target.files[0] && handleCsvUpload(e.target.files[0])} style={{ display: 'none' }} />
              {csvImported > 0 && (
                <div style={{ padding: '10px 12px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--success)', marginTop: 8 }}>
                  Imported {csvImported} contacts
                </div>
              )}
            </div>

            <div style={s.section}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Or Add Manually</div>
              {manualLeads.map((lead, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...s.input, fontSize: 12 }} value={lead.full_name} onChange={e => updateManualLead(i, 'full_name', e.target.value)} placeholder="Name" />
                  <input style={{ ...s.input, fontSize: 12 }} value={lead.company} onChange={e => updateManualLead(i, 'company', e.target.value)} placeholder="Company" />
                  <input style={{ ...s.input, fontSize: 12 }} value={lead.title} onChange={e => updateManualLead(i, 'title', e.target.value)} placeholder="Title" />
                  <input style={{ ...s.input, fontSize: 12 }} value={lead.email} onChange={e => updateManualLead(i, 'email', e.target.value)} placeholder="Email" />
                </div>
              ))}
              <button onClick={addManualRow} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                + Add another contact
              </button>
            </div>
          </>
        )}

        {/* Step 5: Completion */}
        {step === 5 && (
          <>
            <div style={s.stepNum}>Step 5 of {TOTAL_STEPS}</div>
            <div style={s.heading}>You're All Set!</div>
            <div style={s.sub}>Your GovCon CRM is ready to go</div>

            <div style={s.section}>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Here's what you can do next:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>📊</span>
                    <div><strong>Dashboard</strong> — see your pipeline at a glance with fit scores and deadlines</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>🔍</span>
                    <div><strong>Opportunities</strong> — search SAM.gov for live contracts scored against your profile</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>🤝</span>
                    <div><strong>Teaming Marketplace</strong> — find prime contractors and subcontracting partners</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>🤖</span>
                    <div><strong>AI Coach</strong> — get personalized GovCon strategy advice</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
          <div>
            {step > 1 && (
              <button style={s.btn(false)} onClick={() => setStep(step - 1)} disabled={saving}>
                Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {step < TOTAL_STEPS && (
              <button style={s.skipBtn} onClick={skip}>
                Skip this step
              </button>
            )}
            <button
              style={{ ...s.btn(true), flex: 'none', padding: '11px 28px', opacity: saving ? 0.6 : 1 }}
              onClick={goNext}
              disabled={saving}
            >
              {step === TOTAL_STEPS
                ? saving ? 'Setting up...' : 'Go to Dashboard'
                : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
