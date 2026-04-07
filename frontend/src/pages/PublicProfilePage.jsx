import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

export default function PublicProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/public/sub/${id}`)
      .then(r => setProfile(r.data))
      .catch(e => setError(e.response?.data?.error || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const fmtMoney = (v) => {
    if (!v) return null;
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const s = {
    page: { minHeight: '100vh', background: '#0d0d1a', color: '#e2e2e8', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    container: { maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' },
    header: { textAlign: 'center', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    logo: { fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: '#818cf8', letterSpacing: '-0.5px' },
    logoSub: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 },
    company: { fontSize: 28, fontWeight: 700, marginTop: 20, marginBottom: 4 },
    tagline: { fontSize: 15, color: '#9898b0', lineHeight: 1.5 },
    section: { marginBottom: '1.5rem' },
    sectionTitle: { fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 10 },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: 8 },
    chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
    chip: { display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'rgba(129,140,248,0.1)', color: '#a5b4fc', border: '1px solid rgba(129,140,248,0.15)' },
    chipGreen: { display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.15)' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    infoLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 },
    infoVal: { fontSize: 14, color: '#e2e2e8' },
    ppCard: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 16px', marginBottom: 6 },
    footer: { textAlign: 'center', padding: '2rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '2rem' },
    cta: { display: 'inline-block', background: '#6366f1', color: '#fff', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 },
  };

  if (loading) return (
    <div style={s.page}>
      <div style={{ ...s.container, textAlign: 'center', paddingTop: '4rem' }}>
        <div style={s.logo}>SubK</div>
        <div style={{ color: '#666', marginTop: 16 }}>Loading profile...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={s.page}>
      <div style={{ ...s.container, textAlign: 'center', paddingTop: '4rem' }}>
        <div style={s.logo}>SubK</div>
        <div style={{ color: '#ef4444', marginTop: 16, fontSize: 15 }}>{error}</div>
        <div style={{ color: '#666', marginTop: 8, fontSize: 13 }}>This profile may be private or no longer available.</div>
      </div>
    </div>
  );

  const certs = profile.certifications ? profile.certifications.split(',').map(c => c.trim()).filter(Boolean) : [];
  const naics = profile.naics_codes ? profile.naics_codes.split(',').map(c => c.trim()).filter(Boolean) : [];
  const agencies = profile.target_agencies ? profile.target_agencies.split(',').map(c => c.trim()).filter(Boolean) : [];

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>SubK</div>
          <div style={s.logoSub}>GovCon Teaming Marketplace</div>
          <div style={s.company}>{profile.company_name}</div>
          {profile.tagline && <div style={s.tagline}>{profile.tagline}</div>}
          {profile.contact_name && (
            <div style={{ fontSize: 13, color: '#9898b0', marginTop: 8 }}>Contact: {profile.contact_name}</div>
          )}
        </div>

        {/* Quick Info */}
        <div style={{ ...s.grid2, marginBottom: '1.5rem' }}>
          {profile.state && (
            <div style={s.card}>
              <div style={s.infoLabel}>Location</div>
              <div style={s.infoVal}>{profile.state}</div>
            </div>
          )}
          {profile.website_url && (
            <div style={s.card}>
              <div style={s.infoLabel}>Website</div>
              <div style={s.infoVal}>
                <a href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`}
                  target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                  {profile.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}
          {profile.cage_code && (
            <div style={s.card}>
              <div style={s.infoLabel}>CAGE Code</div>
              <div style={s.infoVal}>{profile.cage_code}</div>
            </div>
          )}
          {profile.uei && (
            <div style={s.card}>
              <div style={s.infoLabel}>UEI {profile.uei_verified && <span style={{ color: '#22c55e' }}>&#x2713; Verified</span>}</div>
              <div style={s.infoVal}>{profile.uei}</div>
            </div>
          )}
          {(profile.contract_min > 0 || profile.contract_max > 0) && (
            <div style={s.card}>
              <div style={s.infoLabel}>Contract Range</div>
              <div style={s.infoVal}>{fmtMoney(profile.contract_min)} &ndash; {fmtMoney(profile.contract_max)}</div>
            </div>
          )}
        </div>

        {/* Certifications */}
        {certs.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Certifications</div>
            <div style={s.chips}>
              {certs.map(c => <span key={c} style={s.chipGreen}>{c}</span>)}
            </div>
          </div>
        )}

        {/* NAICS */}
        {naics.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>NAICS Codes</div>
            <div style={s.chips}>
              {naics.map(n => <span key={n} style={s.chip}>{n}</span>)}
            </div>
          </div>
        )}

        {/* Capabilities */}
        {profile.capabilities && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Core Capabilities</div>
            <div style={{ ...s.card, fontSize: 14, lineHeight: 1.6, color: '#c8c8d8' }}>
              {profile.capabilities}
            </div>
          </div>
        )}

        {/* Target Agencies */}
        {agencies.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Target Agencies</div>
            <div style={s.chips}>
              {agencies.map(a => <span key={a} style={s.chip}>{a}</span>)}
            </div>
          </div>
        )}

        {/* Set-Aside Preferences */}
        {profile.set_aside_prefs && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Set-Aside Preferences</div>
            <div style={s.chips}>
              {profile.set_aside_prefs.split(',').map(s2 => s2.trim()).filter(Boolean).map(sa => (
                <span key={sa} style={s.chip}>{sa}</span>
              ))}
            </div>
          </div>
        )}

        {/* Past Performance */}
        {profile.past_performance?.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Past Performance ({profile.past_performance.length} records)</div>
            {profile.past_performance.map((pp, i) => (
              <div key={i} style={s.ppCard}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{pp.contract_title || 'Contract'}</div>
                <div style={{ fontSize: 12, color: '#9898b0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {pp.agency && <span>{pp.agency}</span>}
                  {pp.prime_or_sub && <span style={{ textTransform: 'capitalize' }}>{pp.prime_or_sub}</span>}
                  {pp.award_amount && <span>{fmtMoney(pp.award_amount)}</span>}
                  {pp.naics_code && <span>NAICS {pp.naics_code}</span>}
                  {pp.period_start && <span>{new Date(pp.period_start).getFullYear()}{pp.period_end ? `\u2013${new Date(pp.period_end).getFullYear()}` : '+'}</span>}
                </div>
                {pp.description && (
                  <div style={{ fontSize: 13, color: '#b0b0c0', marginTop: 6, lineHeight: 1.5 }}>{pp.description}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer / CTA */}
        <div style={s.footer}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Interested in teaming? Connect with {profile.company_name} on SubK.
          </div>
          <a href="/signup" style={s.cta}>Join SubK Free</a>
          <div style={{ fontSize: 11, color: '#444', marginTop: 16 }}>
            Powered by <span style={{ color: '#818cf8', fontWeight: 600 }}>SubK</span> &middot; GovCon Teaming Marketplace
          </div>
        </div>
      </div>
    </div>
  );
}
