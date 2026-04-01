import { useNavigate } from 'react-router-dom';

const s = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'Inter', sans-serif" },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 3rem', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)', zIndex: 100 },
  navLogo: { fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: '#f0f0f5' },
  navRight: { display: 'flex', gap: 12, alignItems: 'center' },
  loginBtn: { padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#9090a8', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  signupBtn: { padding: '8px 20px', background: '#6c63ff', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  hero: { textAlign: 'center', padding: '6rem 2rem 4rem', maxWidth: 800, margin: '0 auto' },
  eyebrow: { display: 'inline-block', padding: '4px 14px', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 20, fontSize: 12, fontWeight: 500, color: '#8b84ff', marginBottom: '1.5rem', letterSpacing: '0.5px', textTransform: 'uppercase' },
  h1: { fontSize: 56, fontWeight: 700, fontFamily: 'Syne, sans-serif', lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-1px' },
  h1Accent: { color: '#6c63ff' },
  heroSub: { fontSize: 18, color: '#9090a8', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 600, margin: '0 auto 2.5rem' },
  heroBtns: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  ctaPrimary: { padding: '14px 32px', background: '#6c63ff', border: 'none', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  ctaSecondary: { padding: '14px 32px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#f0f0f5', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  trialNote: { fontSize: 13, color: '#5a5a70', marginTop: 14, textAlign: 'center' },
  features: { padding: '5rem 3rem', maxWidth: 1100, margin: '0 auto' },
  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 },
  featureCard: { background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '1.75rem' },
  featureIcon: { fontSize: 28, marginBottom: '1rem' },
  featureTitle: { fontSize: 16, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 8 },
  featureDesc: { fontSize: 13, color: '#9090a8', lineHeight: 1.7 },
  sectionTitle: { fontSize: 36, fontWeight: 700, fontFamily: 'Syne, sans-serif', textAlign: 'center', marginBottom: 12, letterSpacing: '-0.5px' },
  sectionSub: { fontSize: 15, color: '#9090a8', textAlign: 'center', marginBottom: '3rem' },
  pricing: { padding: '5rem 3rem', maxWidth: 1000, margin: '0 auto' },
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  planCard: (featured) => ({ background: featured ? 'rgba(108,99,255,0.08)' : '#111118', border: featured ? '1px solid rgba(108,99,255,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '2rem', position: 'relative' }),
  planBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#6c63ff', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.5px', textTransform: 'uppercase' },
  planName: { fontSize: 18, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 8 },
  planPrice: { fontSize: 36, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 },
  planPer: { fontSize: 13, color: '#9090a8', marginBottom: '1.5rem' },
  planFeature: { fontSize: 13, color: '#9090a8', marginBottom: 8, paddingLeft: 20, position: 'relative' },
  planFeatureDot: { position: 'absolute', left: 0, color: '#6c63ff' },
  planBtn: (featured) => ({ width: '100%', padding: '11px', background: featured ? '#6c63ff' : 'transparent', border: featured ? 'none' : '1px solid rgba(255,255,255,0.15)', color: featured ? '#fff' : '#f0f0f5', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: '1.5rem' }),
  howItWorks: { padding: '5rem 3rem', maxWidth: 900, margin: '0 auto' },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: '3rem' },
  step: { textAlign: 'center', padding: '1.5rem 1rem' },
  stepNum: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 15, fontWeight: 600, color: '#8b84ff' },
  stepTitle: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  stepDesc: { fontSize: 12, color: '#9090a8', lineHeight: 1.6 },
  footer: { padding: '2rem 3rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { fontSize: 13, color: '#5a5a70' },
};

const FEATURES = [
  { icon: '🔍', title: 'AI prospect research', desc: 'Claude researches every lead before writing — company intel, role context, industry pressures. No generic outreach.' },
  { icon: '✉️', title: '4-touch email cadence', desc: 'Day 1, 3, 7, and 14 emails — each a completely different angle. Written to sound human, not AI.' },
  { icon: '📞', title: 'Call openers & callbacks', desc: 'Exactly what to say in the first 20 seconds. Discovery questions. Brush-off responses. 8 conversation callbacks.' },
  { icon: '🎭', title: 'Role-based messaging', desc: 'SDR, AE, AM, CSM, and SE all get completely different playbooks. The right message for your role.' },
  { icon: '💬', title: 'AI sales coach', desc: 'Chat with an AI coach per lead. Rewrite any section, prep for objections, ask anything about the prospect.' },
  { icon: '🔗', title: 'Zoho CRM sync', desc: 'Push contacts and full playbooks to Zoho CRM with one click. Keep your CRM in sync automatically.' },
  { icon: '📊', title: 'ICP lead scoring', desc: 'Score your entire lead list against your ICP. Sorted by fit so you work the best leads first.' },
  { icon: '📁', title: 'ZoomInfo CSV import', desc: 'Drop in your ZoomInfo export and we handle the rest. All column formats supported automatically.' },
  { icon: '👥', title: 'Team accounts', desc: 'Invite your whole team. Shared company profile, individual roles and accounts. One invite link.' },
];

const PLANS = [
  { name: 'Starter', price: '$49', per: '/month', playbooks: '100 playbooks/mo', users: '1 user', exports: 'PDF exports', zoho: 'Zoho CRM sync', featured: false },
  { name: 'Team', price: '$149', per: '/month', playbooks: '500 playbooks/mo', users: '5 users', exports: 'PDF exports', zoho: 'Zoho CRM sync', featured: true },
  { name: 'Pro', price: '$299', per: '/month', playbooks: 'Unlimited playbooks', users: 'Unlimited users', exports: 'PDF exports', zoho: 'Zoho CRM sync', featured: false },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Syne:wght@600;700&display=swap" rel="stylesheet" />

      <nav style={s.nav}>
        <div style={s.navLogo}>ProspectForge</div>
        <div style={s.navRight}>
          <button style={s.loginBtn} onClick={() => navigate('/login')}>Sign in</button>
          <button style={s.signupBtn} onClick={() => navigate('/signup')}>Start free trial</button>
        </div>
      </nav>

      <div style={s.hero}>
        <div style={s.eyebrow}>AI-Powered Sales Intelligence</div>
        <h1 style={s.h1}>
          Personalized playbooks for <span style={s.h1Accent}>every prospect</span>
        </h1>
        <p style={s.heroSub}>
          ProspectForge researches your leads, then generates fully personalized email sequences, call openers, objection handling, and LinkedIn messages — tailored to each person's company, role, and situation.
        </p>
        <div style={s.heroBtns}>
          <button style={s.ctaPrimary} onClick={() => navigate('/signup')}>Start free trial →</button>
          <button style={s.ctaSecondary} onClick={() => navigate('/login')}>Sign in</button>
        </div>
        <div style={s.trialNote}>10 free playbooks · No credit card required · Work email required</div>
      </div>

      <div style={s.howItWorks}>
        <div style={s.sectionTitle}>How it works</div>
        <div style={s.sectionSub}>From lead list to personalized playbook in under a minute</div>
        <div style={s.steps}>
          {[
            { n: 1, t: 'Set up your profile', d: 'Enter your company, product, ICP, and value props. Paste your website URL to auto-fill.' },
            { n: 2, t: 'Import your leads', d: 'Drop in a CSV from ZoomInfo or add leads manually. We handle any column format.' },
            { n: 3, t: 'Generate playbooks', d: 'AI researches each prospect and writes a fully personalized playbook in ~20 seconds.' },
            { n: 4, t: 'Go sell', d: 'Send emails, make calls, push to Zoho. Your AI coach is always one click away.' },
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
        <div style={s.sectionTitle}>Everything you need to prospect better</div>
        <div style={s.sectionSub}>Built for sales teams that need to move fast without sacrificing personalization</div>
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
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: 13, color: '#5a5a70' }}>
          All plans include a 10 playbook free trial. No credit card required to start.
        </div>
      </div>

      <footer style={s.footer}>
        <div style={s.footerLeft}>© 2026 ProspectForge. All rights reserved.</div>
        <div style={{ fontSize: 13, color: '#5a5a70' }}>Built for modern sales teams</div>
      </footer>
    </div>
  );
}
