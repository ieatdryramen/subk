import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const COMMON_NAICS = [
  '541512 - Computer Systems Design', '541511 - Custom Computer Programming',
  '541330 - Engineering Services', '541690 - Other Scientific/Technical Consulting',
  '541611 - Management Consulting', '541519 - Other Computer Related Services',
  '561210 - Facilities Support Services', '238 - Construction',
  '334 - Computer & Electronic Manufacturing', '611 - Educational Services',
];

const SET_ASIDES = ['Small Business', '8(a)', 'HUBZone', 'SDVOSB', 'VOSB', 'WOSB', 'EDWOSB', 'SDB'];

export default function OnboardingPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [uploadMode, setUploadMode] = useState(true); // true = upload PDF, false = manual entry
  const [form, setForm] = useState({
    company_name: '',
    naics_codes: '',
    certifications: '',
  });
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [searchForm, setSearchForm] = useState({
    naics_codes: '',
    keywords: '',
    agency: '',
    set_aside: 'all',
  });
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const toggleCert = (cert) => {
    const next = selectedCerts.includes(cert)
      ? selectedCerts.filter(c => c !== cert)
      : [...selectedCerts, cert];
    setSelectedCerts(next);
    setForm(f => ({ ...f, certifications: next.join(', ') }));
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
        naics_codes: extracted.naics_codes || f.naics_codes,
        certifications: extracted.certifications || f.certifications,
      }));

      if (extracted.certifications) {
        const newCerts = extracted.certifications.split(',').map(c => c.trim()).filter(Boolean);
        setSelectedCerts(newCerts);
      }

      setParseMsg(`✓ Extracted: ${extracted.company_name || 'Company'} · ${extracted.naics_codes ? '1 NAICS' : '0 NAICS'} codes`);
      showToast('Capability statement parsed successfully', 'success');
      setTimeout(() => setStep(3), 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setParseMsg('Failed to parse PDF: ' + errorMsg);
      showToast('Failed to parse: ' + errorMsg, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) parseCapStatement(files[0]);
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) parseCapStatement(files[0]);
  };

  const goNext = async () => {
    if (step === 1) {
      if (uploadMode && !parseMsg.includes('✓')) {
        showToast('Please upload your capability statement first', 'error');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!form.company_name.trim()) {
        showToast('Please enter your company name', 'error');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!searchForm.naics_codes.trim()) {
        showToast('Please select NAICS codes', 'error');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      await saveAndRedirect();
    }
  };

  const saveAndRedirect = async () => {
    setSaving(true);
    try {
      await api.post('/sub-profile', { ...form, certifications: selectedCerts.join(', ') });
      showToast('Profile saved successfully', 'success');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to save profile';
      showToast(errorMsg, 'error');
      setSaving(false);
    }
  };

  const s = {
    container: {
      padding: '2rem 2.5rem',
      maxWidth: 700,
      margin: '0 auto',
    },
    progressBar: {
      marginBottom: '2rem',
      height: 4,
      background: 'var(--bg3)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      width: `${(step / 4) * 100}%`,
      background: 'var(--accent)',
      transition: 'width 0.3s',
    },
    stepNum: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--accent2)',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      marginBottom: 8,
    },
    heading: {
      fontSize: 26,
      fontWeight: 700,
      marginBottom: 4,
    },
    sub: {
      color: 'var(--text2)',
      fontSize: 14,
      marginBottom: '2rem',
    },
    section: {
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    },
    field: {
      marginBottom: 16,
    },
    label: {
      display: 'block',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--text2)',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      marginBottom: 6,
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      color: 'var(--text)',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s, background-color 0.2s',
    },
    uploadZone: (dragging) => ({
      border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '2rem',
      textAlign: 'center',
      cursor: 'pointer',
      background: dragging ? 'var(--accent-bg)' : 'var(--bg3)',
      transition: 'all 0.15s',
    }),
    uploadIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    certGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    certBtn: (active) => ({
      padding: '6px 12px',
      fontSize: 12,
      fontWeight: 500,
      borderRadius: 20,
      cursor: 'pointer',
      background: active ? 'var(--accent-bg)' : 'var(--bg3)',
      color: active ? 'var(--accent2)' : 'var(--text2)',
      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    }),
    buttons: {
      display: 'flex',
      gap: 12,
      marginTop: '2rem',
    },
    btn: (primary) => ({
      flex: 1,
      padding: '11px',
      background: primary ? 'var(--accent)' : 'var(--bg3)',
      color: primary ? '#fff' : 'var(--text2)',
      border: primary ? 'none' : '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    }),
    tabButtons: {
      display: 'flex',
      gap: 10,
      marginBottom: '1rem',
    },
    tabBtn: (active) => ({
      flex: 1,
      padding: '8px 12px',
      background: active ? 'var(--accent-bg)' : 'var(--bg)',
      color: active ? 'var(--accent2)' : 'var(--text2)',
      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
    }),
    msgBox: (type) => ({
      padding: '10px 12px',
      background: type === 'success' ? 'var(--success-bg)' : type === 'error' ? 'var(--danger-bg)' : type === 'info' ? 'var(--bg3)' : 'var(--bg3)',
      color: type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : type === 'info' ? 'var(--text2)' : 'var(--text2)',
      border: type === 'success' ? '1px solid var(--success)' : type === 'error' ? '1px solid var(--danger)' : type === 'info' ? '1px solid var(--border)' : '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      marginTop: 8,
    }),
  };

  return (
    <Layout>
      <div style={s.container}>
        <div style={s.progressBar}>
          <div style={s.progressFill} />
        </div>

        {step === 1 && (
          <>
            <div style={s.stepNum}>Step 1 of 4</div>
            <div style={s.heading}>Upload Your Capability Statement</div>
            <div style={s.sub}>Optional: drag & drop your PDF for instant parsing</div>

            <div style={s.section}>
              <div style={s.tabButtons}>
                <button
                  style={s.tabBtn(uploadMode)}
                  onClick={() => setUploadMode(true)}
                >
                  Upload PDF
                </button>
                <button
                  style={s.tabBtn(!uploadMode)}
                  onClick={() => setUploadMode(false)}
                >
                  Skip
                </button>
              </div>

              {uploadMode ? (
                <>
                  <div
                    style={s.uploadZone(dragging)}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div style={s.uploadIcon}>📄</div>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>Drag your capability statement PDF</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>or click to browse</div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {parsing && <div style={s.msgBox('info')}>⏳ Parsing your capability statement...</div>}
                  {parseMsg && !parsing && <div style={{ ...s.msgBox(parseMsg.includes('✓') ? 'success' : 'error') }}>{parseMsg}</div>}
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text2)', padding: '1rem 0' }}>
                  No problem! You can fill in your company info on the next step.
                </div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={s.stepNum}>Step 2 of 4</div>
            <div style={s.heading}>Company Information</div>
            <div style={s.sub}>Tell us about your company</div>

            <div style={s.section}>
              <div style={s.field}>
                <label style={s.label}>Company Name</label>
                <input
                  style={s.input}
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  placeholder="e.g., Acme Solutions Inc."
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>NAICS Codes (Primary)</label>
                <input
                  style={s.input}
                  value={form.naics_codes}
                  onChange={e => setForm({ ...form, naics_codes: e.target.value })}
                  placeholder="e.g., 541512, 541330"
                  list="naics-list"
                />
                <datalist id="naics-list">
                  {COMMON_NAICS.map(code => (
                    <option key={code} value={code.split(' - ')[0]} />
                  ))}
                </datalist>
              </div>

              <div style={s.field}>
                <label style={s.label}>Set-Aside Status</label>
                <div style={s.certGrid}>
                  {SET_ASIDES.map(cert => (
                    <button
                      key={cert}
                      style={s.certBtn(selectedCerts.includes(cert))}
                      onClick={() => toggleCert(cert)}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={s.stepNum}>Step 3 of 4</div>
            <div style={s.heading}>Run Your First Search</div>
            <div style={s.sub}>Let's find opportunities that match your capabilities</div>

            <div style={s.section}>
              <div style={s.field}>
                <label style={s.label}>NAICS Codes</label>
                <input
                  style={s.input}
                  value={searchForm.naics_codes}
                  onChange={e => setSearchForm({ ...searchForm, naics_codes: e.target.value })}
                  placeholder="e.g., 541512, 541330"
                  list="search-naics-list"
                />
                <datalist id="search-naics-list">
                  {COMMON_NAICS.map(code => (
                    <option key={code} value={code.split(' - ')[0]} />
                  ))}
                </datalist>
              </div>

              <div style={s.field}>
                <label style={s.label}>Keywords (Optional)</label>
                <input
                  style={s.input}
                  value={searchForm.keywords}
                  onChange={e => setSearchForm({ ...searchForm, keywords: e.target.value })}
                  placeholder="e.g., cloud computing, AI, cybersecurity"
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Agency (Optional)</label>
                <input
                  style={s.input}
                  value={searchForm.agency}
                  onChange={e => setSearchForm({ ...searchForm, agency: e.target.value })}
                  placeholder="e.g., DoD, GSA, HHS"
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Set-Aside</label>
                <select
                  style={s.input}
                  value={searchForm.set_aside}
                  onChange={e => setSearchForm({ ...searchForm, set_aside: e.target.value })}
                >
                  <option value="all">All</option>
                  <option value="Small Business Set-Aside">Small Business Set-Aside</option>
                  <option value="8(a)">8(a)</option>
                  <option value="HUBZone">HUBZone</option>
                  <option value="SDVOSB">SDVOSB</option>
                  <option value="WOSB">WOSB</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={s.stepNum}>Step 4 of 4</div>
            <div style={s.heading}>You're All Set!</div>
            <div style={s.sub}>Your profile is ready. Let's get started!</div>

            <div style={s.section}>
              <div style={{ fontSize: 28, marginBottom: '1rem', textAlign: 'center' }}>🎉</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                <strong>Next steps:</strong>
                <ul style={{ marginTop: 8, paddingLeft: '1.25rem' }}>
                  <li>Go to your <strong>Dashboard</strong> for a quick overview</li>
                  <li>Visit <strong>Opportunities</strong> to track and bid on contracts</li>
                  <li>Use <strong>Prime Tracker</strong> to manage teaming relationships</li>
                  <li>Chat with the <strong>AI Coach</strong> for personalized advice</li>
                </ul>
              </div>
            </div>
          </>
        )}

        <div style={s.buttons}>
          {step > 1 && (
            <button
              style={s.btn(false)}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button
            style={{ ...s.btn(true), opacity: saving ? 0.6 : 1 }}
            onClick={goNext}
            disabled={saving}
          >
            {step === 4 ? (saving ? 'Setting up...' : 'Go to Dashboard →') : 'Next →'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
