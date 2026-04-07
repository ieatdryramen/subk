import { useNavigate } from 'react-router-dom';

const s = {
  page: { minHeight: '100vh', background: '#F4F7FA', color: '#1A202C', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 3rem', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 100 },
  navLogo: { fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: '#1A202C' },
  navRight: { display: 'flex', gap: 12, alignItems: 'center' },
  loginBtn: { padding: '8px 18px', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#4A5568', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  signupBtn: { padding: '8px 20px', background: '#08A5BF', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  hero: { textAlign: 'center', padding: '6rem 2rem 4rem', maxWidth: 800, margin: '0 auto' },
  eyebrow: { display: 'inline-block', padding: '4px 14px', background: 'rgba(8,165,191,0.10)', border: '1px solid rgba(8,165,191,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 500, color: '#08A5BF', marginBottom: '1.5rem', letterSpacing: '0.5px', textTransform: 'uppercase' },
  h1: { fontSize: 56, fontWeight: 700, fontFamily: 'Syne, sans-serif', lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-1px' },
  h1Accent: { color: '#08A5BF' },
  heroSub: { fontSize: 18, color: '#6B7280', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 600, margin: '0 auto 2.5rem' },
  heroBtns: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  ctaPrimary: { padding: '14px 32px', background: '#08A5BF', border: 'none', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  ctaSecondary: { padding: '14px 32px', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#1A202C', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  trialNote: { fontSize: 13, color: '#9CA3AF', marginTop: 14, textAlign: 'center' },
  features: { padding: '5rem 3rem', maxWidth: 1100, margin: '0 auto' },
  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 },
  featureCard: { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '1.75rem' },
  featureIcon: { fontSize: 28, marginBottom: '1rem' },
  featureTitle: { fontSize: 16, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 8 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 1.7 },
  sectionTitle: { fontSize: 36, fontWeight: 700, fontFamily: 'Syne, sans-serif', textAlign: 'center', marginBottom: 12, letterSpacing: '-0.5px' },
  sectionSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: '3rem' },
  pricing: { padding: '5rem 3rem', maxWidth: 1000, margin: '0 auto' },
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  planCard: (featured) => ({ background: featured ? 'rgba(8,165,191,0.08)' : '#FFFFFF', border: featured ? '1px solid rgba(8,165,191,0.4)' : '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: '2rem', position: 'relative' }),
  planBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#08A5BF', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.5px', textTransform: 'uppercase' },
  planName: { fontSize: 18, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 8 },
  planPrice: { fontSize: 36, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 },
  planPer: { fontSize: 13, color: '#6B7280', marginBottom: '1.5rem' },
  planFeature: { fontSize: 13, color: '#6B7280', marginBottom: 8, paddingLeft: 20, position: 'relative' },
  planFeatureDot: { position: 'absolute', left: 0, color: '#08A5BF' },
  planBtn: (featured) => ({ width: '100%', padding: '11px', background: featured ? '#08A5BF' : 'transparent', border: featured ? 'none' : '1px solid rgba(0,0,0,0.12)', color: featured ? '#fff' : '#1A202C', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: '1.5rem' }),
  howItWorks: { padding: '5rem 3rem', maxWidth: 900, margin: '0 auto' },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: '3rem' },
  step: { textAlign: 'center', padding: '1.5rem 1rem' },
  stepNum: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(8,165,191,0.15)', border: '1px solid rgba(8,165,191,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 15, fontWeight: 600, color: '#0CC0DB' },
  stepTitle: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  stepDesc: { fontSize: 12, color: '#6B7280', lineHeight: 1.6 },
  footer: { padding: '2rem 3rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { fontSize: 13, color: '#9CA3AF' },
};

const FEATURES = [
  { icon: '🔍', title: 'Opportunity Intelligence', desc: 'Auto-discover federal opportunities from SAM.gov. AI scores every opportunity against your NAICS, certs, and capabilities.' },
  { icon: '🤝', title: 'Teaming Marketplace', desc: 'Two-sided marketplace connecting primes and subs. Search by NAICS, certifications, past performance, and clearance.' },
  { icon: '📝', title: 'AI Proposal Writer', desc: 'Upload an RFP and let AI draft compliance matrices, technical approaches, and past performance volumes. (Coming soon)' },
  { icon: '🏢', title: 'Prime Tracker', desc: 'Research prime contractors using USASpending data. AI generates teaming pitches and outreach emails tailored to each prime.' },
  { icon: '✉️', title: 'BD Outreach Cadences', desc: 'AI-written email sequences, call openers, and LinkedIn messages — personalized to each prospect using real research.' },
  { icon: '📊', title: 'Capture Pipeline', desc: 'GovCon-specific pipeline from Lead through Award. Track opportunities, proposals, and BD activity in one place.' },
  { icon: '💬', title: 'AI GovCon Coach', desc: 'Chat with an AI coach about any opportunity, prime, or teaming strategy. Practical advice, not generic tips.' },
  { icon: '📋', title: 'Sub Profile & Vetting Card', desc: 'Build a rich sub profile with UEI verification, SAM.gov data, and structured past performance. Share a public vetting link.' },
  { icon: '🔗', title: 'Integrations', desc: 'Zoho CRM sync, Gmail connect, Stripe billing, and more. Built to work alongside your existing tools.' },
];

const PLANS = [
  { name: 'Starter', price: '$99', per: '/user/month', playbooks: 'Opportunity search + scoring', users: '1 user', exports: '5 AI proposals/mo', zoho: 'Teaming marketplace', featured: false },
  { name: 'Professional', price: '$249', per: '/user/month', playbooks: 'Unlimited AI proposals', users: '5 users', exports: 'BD outreach sequences', zoho: 'Compliance checker', featured: true },
  { name: 'Team', price: '$449', per: '/user/month', playbooks: 'Multi-user collaboration', users: 'Unlimited users', exports: 'Advanced analytics', zoho: 'Priority support', featured: false },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@600;700&display=swap" rel="stylesheet" />

      <nav style={s.nav}>
        <div style={s.navLogo}>SumX CRM</div>
        <div style={s.navRight}>
          <button style={s.loginBtn} onClick={() => navigate('/login')}>Sign in</button>
          <button style={s.signupBtn} onClick={() => navigate('/signup')}>Start free trial</button>
        </div>
      </nav>

      <div style={s.hero}>
        <div style={s.eyebrow}>GovCon Intelligence Platform</div>
        <h1 style={s.h1}>
          Find, team, and win <span style={s.h1Accent}>federal contracts</span>
        </h1>
        <p style={s.heroSub}>
          SumX CRM combines opportunity intelligence, AI-powered proposals, prime-sub teaming, and BD outreach in one platform built for government contractors.
        </p>
        <div style={s.heroBtns}>
          <button style={s.ctaPrimary} onClick={() => navigate('/signup')}>Start free trial →</button>
          <button style={s.ctaSecondary} onClick={() => navigate('/login')}>Sign in</button>
        </div>
        <div style={s.trialNote}>Free trial · No credit card required · GovCon focused</div>
      </div>

      <div style={s.howItWorks}>
        <div style={s.sectionTitle}>How it works</div>
        <div style={s.sectionSub}>From profile to winning contracts in four steps</div>
        <div style={s.steps}>
          {[
            { n: 1, t: 'Build your profile', d: 'Upload your cap statement or enter your UEI. We auto-populate NAICS, certs, and past performance from SAM.gov.' },
            { n: 2, t: 'Find opportunities', d: 'AI searches SAM.gov and USASpending for opportunities that match your capabilities and scores them automatically.' },
            { n: 3, t: 'Build your team', d: 'Find teaming partners in the marketplace. Primes find subs, subs find primes. Real data, real past performance.' },
            { n: 4, t: 'Win contracts', d: 'AI helps write proposals, generates outreach to primes, and manages your full capture pipeline.' },
          ].map(step => (
            <div key={step.n} style={s.step}>
              <div style={s.stepNum}>{step.n}</div>
              <div style={s.stepTitle}>{step.t}</div>
              <div style={s.stepDesc}>{step.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.features}>
        <div style={s.sectionTitle}>Everything you need to win GovCon</div>
        <div style={s.sectionSub}>Built for government contractors who need intelligence, teaming, and proposals in one place</div>
        <div style={s.featuresGrid}>
          {FEATURES.map(f => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.pricing}>
        <div style={s.sectionTitle}>Simple pricing</div>
        <div style={s.sectionSub}>Start free. Upgrade when you're ready.</div>
        <div style={s.pricingGrid}>
          {PLANS.map(plan => (
            <div key={plan.name} style={s.planCard(plan.featured)}>
              {plan.featured && <div style={s.planBadge}>Most popular</div>}
              <div style={s.planName}>{plan.name}</div>
              <div style={s.planPrice}>{plan.price}</div>
              <div style={s.planPer}>per month, billed monthly</div>
              {[plan.playbooks, plan.users, plan.exports, plan.zoho].map(f => (
                <div key={f} style={s.planFeature}>
                  <span style={s.planFeatureDot}>✓</span> {f}
                </div>
              ))}
              <button style={s.planBtn(plan.featured)} onClick={() => navigate('/signup')}>
                Get started
              </button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: 13, color: '#9CA3AF' }}>
          All plans include a 10 playbook free trial. No credit card required to start.
        </div>
      </div>

      <footer style={s.footer}>
        <div style={s.footerLeft}>© 2026 SumX CRM. All rights reserved.</div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>Built by SumX AI for government contractors</div>
      </footer>
    </div>
  );
}
