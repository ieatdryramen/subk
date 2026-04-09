const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// POST /api/seed/by-email - Seed for a specific user (secured by ANTHROPIC_API_KEY or bootstrap token)
router.post('/by-email', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  // Use dedicated SEED_API_KEY; fall back to ANTHROPIC_API_KEY if not set
  const expectedKey = process.env.SEED_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !expectedKey || apiKey !== expectedKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const userR = await pool.query('SELECT id, org_id, role FROM users WHERE email=$1', [email]);
  if (!userR.rows.length) return res.status(404).json({ error: 'User not found' });

  // Inject userId and forward to the demo handler
  req.userId = userR.rows[0].id;
  return demoSeedHandler(req, res);
});

// POST /api/seed/demo - Load comprehensive GovCon demo data (admin only)
router.post('/demo', auth, (req, res) => demoSeedHandler(req, res));

async function demoSeedHandler(req, res) {
  const client = await pool.connect();
  try {
    const userR = await client.query('SELECT id, org_id, role FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const results = {
      lead_lists: 0,
      leads: 0,
      opportunities: 0,
      primes: 0,
      marketplace: 0,
      sequence_events: 0,
      notifications: 0,
      proposals: 0,
      competitive_intel: 0,
      profile: false
    };

    // Wipe demo data if it exists (broad cleanup)
    await client.query(`DELETE FROM proposals WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM competitive_intel WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM sequence_events WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM notifications WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM leads WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM lead_lists WHERE user_id = $1`, [user.id]);
    await client.query(`DELETE FROM opportunities WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM shared_opportunities WHERE prime_user_id = $1`, [user.id]);
    await client.query(`DELETE FROM primes WHERE org_id = $1`, [user.org_id]);

    // ── 1. Lead Lists ──
    const listRes1 = await client.query(
      `INSERT INTO lead_lists (user_id, org_id, name, description)
       VALUES ($1, $2, 'DOD Cyber Contacts', 'Defense agency CISO, CTO, and Program Manager contacts') RETURNING id`,
      [user.id, user.org_id]
    );
    const list1Id = listRes1.rows[0].id;
    results.lead_lists++;

    const listRes2 = await client.query(
      `INSERT INTO lead_lists (user_id, org_id, name, description)
       VALUES ($1, $2, 'Civilian Agency IT', 'IT decision-makers at civilian agencies') RETURNING id`,
      [user.id, user.org_id]
    );
    const list2Id = listRes2.rows[0].id;
    results.lead_lists++;

    const listRes3 = await client.query(
      `INSERT INTO lead_lists (user_id, org_id, name, description)
       VALUES ($1, $2, 'GovCon Primes Pipeline', 'Contacts at prime contractors for teaming opportunities') RETURNING id`,
      [user.id, user.org_id]
    );
    const list3Id = listRes3.rows[0].id;
    results.lead_lists++;

    // ── 2. Leads — DOD Cyber Contacts ──
    // status values: not_started, generating, done, pending
    // engagement_status: active, snoozed, cold
    const dodLeads = [
      ['James Rodriguez', 'Defense Information Systems Agency', 'CISO', 'james.rodriguez@disa.mil', 'https://linkedin.com/in/jrodriguez', 'Reston, VA', 85, 'done', 'active'],
      ['Sarah Chen', 'Defense Information Systems Agency', 'Deputy CIO', 'sarah.chen@disa.mil', 'https://linkedin.com/in/schen', 'Fort Meade, MD', 92, 'done', 'active'],
      ['Michael Thompson', 'US Air Force', 'Chief Technology Officer', 'michael.thompson@af.mil', 'https://linkedin.com/in/mthompson', 'Arlington, VA', 88, 'done', 'active'],
      ['Jennifer Williams', 'US Army Cyber Command', 'Director of Operations', 'jennifer.williams@arcyber.army.mil', 'https://linkedin.com/in/jwilliams', 'Fort Gordon, GA', 78, 'done', 'active'],
      ['David Park', 'US Navy Cyber Security Center', 'Program Manager', 'david.park@navy.mil', 'https://linkedin.com/in/dpark', 'Norfolk, VA', 80, 'done', 'snoozed'],
      ['Amanda Foster', 'DoD Information Security', 'Contracting Officer', 'amanda.foster@defense.gov', 'https://linkedin.com/in/afoster', 'Washington, DC', 75, 'done', 'active'],
      ['Robert Garcia', 'Joint Special Operations Command', 'IT Director', 'robert.garcia@socom.mil', 'https://linkedin.com/in/rgarcia', 'MacDill AFB, FL', 82, 'done', 'active'],
      ['Lisa Murphy', 'Defense Cyber Crime Center', 'Senior Analyst', 'lisa.murphy@dc3.mil', 'https://linkedin.com/in/lmurphy', 'Glynco, GA', 76, 'pending', 'cold'],
      ['Christopher Lee', 'NSA Cybersecurity Collaboration Center', 'Program Manager', 'christopher.lee@nsa.gov', 'https://linkedin.com/in/clee', 'Fort Meade, MD', 89, 'done', 'active'],
      ['Patricia Jones', 'US Marine Corps', 'Chief Information Officer', 'patricia.jones@usmc.mil', 'https://linkedin.com/in/pjones', 'Quantico, VA', 81, 'done', 'active'],
      ['Mark Bennett', 'Defense Threat Reduction Agency', 'Director of Technology', 'mark.bennett@dtra.mil', 'https://linkedin.com/in/mbennett', 'Fort Belvoir, VA', 77, 'not_started', 'active'],
      ['Elizabeth Howard', 'Cyber Command', 'Strategic Director', 'elizabeth.howard@cybercom.mil', 'https://linkedin.com/in/ehoward', 'Fort Meade, MD', 90, 'done', 'active'],
    ];

    const dodLeadIds = [];
    for (const [name, company, title, email, linkedin, notes, icp, status, engStatus] of dodLeads) {
      const r = await client.query(
        `INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes, status, icp_score, engagement_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [list1Id, user.id, name, company, title, email, linkedin, notes, status, icp, engStatus]
      );
      dodLeadIds.push(r.rows[0].id);
      results.leads++;
    }

    // ── 3. Leads — Civilian Agency IT ──
    const civilianLeads = [
      ['Kevin Stewart', 'Department of Homeland Security', 'CISO', 'kevin.stewart@dhs.gov', 'https://linkedin.com/in/kstewart', 'Washington, DC', 87, 'done', 'active'],
      ['Angela Mitchell', 'Veterans Affairs', 'Deputy CIO', 'angela.mitchell@va.gov', 'https://linkedin.com/in/amitchell', 'Washington, DC', 84, 'done', 'active'],
      ['Thomas Bailey', 'Department of Energy', 'IT Director', 'thomas.bailey@doe.gov', 'https://linkedin.com/in/tbailey', 'Washington, DC', 79, 'done', 'snoozed'],
      ['Rachel Green', 'General Services Administration', 'Program Manager', 'rachel.green@gsa.gov', 'https://linkedin.com/in/rgreen', 'Washington, DC', 81, 'done', 'active'],
      ['Steven Martinez', 'Department of Health and Human Services', 'Contracting Officer', 'steven.martinez@hhs.gov', 'https://linkedin.com/in/smartinez', 'Rockville, MD', 74, 'pending', 'active'],
      ['Laura Adams', 'Department of Agriculture', 'Chief Technology Officer', 'laura.adams@usda.gov', 'https://linkedin.com/in/ladams', 'Washington, DC', 77, 'done', 'active'],
      ['George Walker', 'Social Security Administration', 'IT Director', 'george.walker@ssa.gov', 'https://linkedin.com/in/gwalker', 'Baltimore, MD', 70, 'not_started', 'cold'],
      ['Carol Davis', 'Environmental Protection Agency', 'Deputy Director IT', 'carol.davis@epa.gov', 'https://linkedin.com/in/cdavis', 'Washington, DC', 72, 'done', 'active'],
      ['Edward Clark', 'Treasury Department', 'Senior IT Manager', 'edward.clark@treasury.gov', 'https://linkedin.com/in/eclark', 'Washington, DC', 68, 'done', 'active'],
      ['Margaret Taylor', 'Office of Personnel Management', 'CISO', 'margaret.taylor@opm.gov', 'https://linkedin.com/in/mtaylor', 'Washington, DC', 76, 'done', 'active'],
    ];

    const civLeadIds = [];
    for (const [name, company, title, email, linkedin, notes, icp, status, engStatus] of civilianLeads) {
      const r = await client.query(
        `INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes, status, icp_score, engagement_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [list2Id, user.id, name, company, title, email, linkedin, notes, status, icp, engStatus]
      );
      civLeadIds.push(r.rows[0].id);
      results.leads++;
    }

    // ── 4. Leads — GovCon Primes Pipeline (teaming contacts) ──
    const primeLeads = [
      ['David Chen', 'Booz Allen Hamilton', 'Director of Teaming', 'd.chen@bah.com', 'https://linkedin.com/in/dchen-bah', 'McLean, VA', 91, 'done', 'active'],
      ['Sarah Mitchell', 'Leidos Holdings', 'VP Small Business Programs', 's.mitchell@leidos.com', 'https://linkedin.com/in/smitchell-leidos', 'Reston, VA', 88, 'done', 'active'],
      ['Jennifer Park', 'SAIC', 'Small Business Liaison Officer', 'j.park@saic.com', 'https://linkedin.com/in/jpark-saic', 'Reston, VA', 82, 'pending', 'active'],
      ['Amanda White', 'Peraton', 'Teaming Coordinator', 'a.white@peraton.com', 'https://linkedin.com/in/awhite-peraton', 'Herndon, VA', 85, 'done', 'active'],
      ['Robert Taylor', 'ManTech International', 'VP Business Development', 'r.taylor@mantech.com', 'https://linkedin.com/in/rtaylor-mantech', 'Fairfax, VA', 79, 'not_started', 'active'],
    ];

    for (const [name, company, title, email, linkedin, notes, icp, status, engStatus] of primeLeads) {
      await client.query(
        `INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes, status, icp_score, engagement_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [list3Id, user.id, name, company, title, email, linkedin, notes, status, icp, engStatus]
      );
      results.leads++;
    }

    // ── 5. Opportunity Search ──
    const searchRes = await client.query(
      `INSERT INTO opportunity_searches (user_id, org_id, name, naics_codes, keywords, agency, status)
       VALUES ($1, $2, 'IT Services & Cybersecurity', '541512,541519,518210', 'cybersecurity, cloud migration, IT modernization, FedRAMP, zero trust', 'All', 'active')
       RETURNING id`,
      [user.id, user.org_id]
    );
    const searchId = searchRes.rows[0].id;

    // ── 6. Opportunities — varied agencies, spread of fit scores ──
    // Fit scores: 4 high (80+), 3 medium (50-70), 3 low (20-45)
    const opps = [
      // HIGH FIT (80+) — core competency matches
      ['APEX-2026-001', 'Enterprise Cloud Migration Services', 'Department of Defense', 'Defense Information Systems Agency', '541512', 'Small Business Set-Aside', '2026-04-07', '2026-05-01 17:00:00', 5000000, 15000000, 'DISA seeks qualified small businesses for enterprise cloud migration services including assessment, planning, migration execution, and post-migration support for AWS GovCloud environment.', 'Fort Meade, MD', 'HC1028-26-R-0042', 92, 'Perfect NAICS match (541512), cloud migration is core Apex capability, SB set-aside eligible, AWS GovCloud experience directly relevant', 'tracking'],
      ['APEX-2026-002', 'Zero Trust Architecture Implementation', 'Department of the Air Force', 'Space Systems Command', '541519', 'Total Small Business', '2026-04-08', '2026-04-28 14:00:00', 8000000, 25000000, 'USSF requires implementation of zero trust architecture across satellite command networks including identity management, microsegmentation, and continuous monitoring.', 'Los Angeles, CA', 'FA4400-26-R-8501', 88, 'Excellent fit: zero trust is core capability, cybersecurity NAICS match, architecture design experience', 'saved'],
      ['APEX-2026-003', 'FedRAMP Authorization Support Services', 'General Services Administration', 'Federal Acquisition Service', '541519', 'Best Value', '2026-04-09', '2026-05-10 14:00:00', 3000000, 10000000, 'GSA seeks experienced consulting firms to support FedRAMP authorization, audit readiness, continuous monitoring, and compliance remediation for cloud service providers.', 'Washington, DC', 'GS-00F-26-0128', 90, 'FedRAMP consulting is a core Apex service line, direct authorization experience, strong past performance', 'tracking'],
      ['APEX-2026-004', 'Cybersecurity Operations Center Support', 'Department of Homeland Security', 'Cybersecurity and Infrastructure Security Agency', '541519', 'SDVOSB', '2026-04-10', '2026-05-15 17:00:00', 12000000, 35000000, 'CISA requires 24/7 cybersecurity operations center support including threat hunting, incident response, vulnerability management, and security analytics.', 'Arlington, VA', 'HSFE80-26-R-0015', 85, 'SDVOSB set-aside matches Apex certification, strong SOC experience, 24/7 staffing model proven', 'tracking'],

      // MEDIUM FIT (50-70) — partial capability alignment
      ['APEX-2026-005', 'IT Infrastructure Modernization', 'Department of Veterans Affairs', 'Office of Information and Technology', '541512', '8(a) Sole Source', '2026-04-12', '2026-06-15 12:00:00', 2000000, 8000000, 'VA OIT requires legacy system modernization including mainframe migration, API gateway development, and hybrid cloud architecture for veteran health records.', 'Washington, DC', 'VA118-26-R-0089', 65, 'IT modernization aligns broadly but healthcare records domain is outside core experience, 8(a) eligible', 'saved'],
      ['APEX-2026-006', 'Data Center Consolidation', 'Department of Energy', 'Office of Information Management', '541512', 'Best Value', '2026-04-13', '2026-05-20 12:00:00', 15000000, 40000000, 'DOE requires consolidation of 12 regional data centers into centralized cloud infrastructure meeting FISMA High and nuclear security compliance.', 'Golden, CO', 'DE-SOL-26-00291', 58, 'Cloud migration relevant but nuclear compliance and FISMA High specialization needed — Apex has general cloud but not DOE-specific clearances', 'new'],
      ['APEX-2026-007', 'Network Security Assessment Services', 'Department of Health and Human Services', 'Information Security Division', '541519', 'Small Business Set-Aside', '2026-04-14', '2026-05-25 14:00:00', 1500000, 5000000, 'HHS seeks comprehensive network security assessment including vulnerability scanning, penetration testing, HIPAA compliance evaluation, and remediation planning.', 'Rockville, MD', 'HHS-ISD-26-R-00156', 62, 'Security assessment capability matches, but HIPAA domain expertise is limited — would need healthcare compliance SME', 'new'],

      // LOW FIT (20-45) — outside core competency
      ['APEX-2026-008', 'Satellite Ground Station Maintenance', 'Department of Defense', 'Space Development Agency', '334220', 'Full and Open', '2026-04-15', '2026-06-01 17:00:00', 25000000, 75000000, 'SDA requires maintenance and sustainment of ground-based satellite terminals including RF systems, antenna tracking, signal processing, and facility management.', 'Huntsville, AL', 'HQ0860-26-R-0033', 22, 'Wrong NAICS (manufacturing), hardware/RF engineering outside Apex IT services scope, no satellite domain experience', 'new'],
      ['APEX-2026-009', 'Financial Management System Modernization', 'Department of the Treasury', 'Bureau of the Fiscal Service', '541511', 'Best Value', '2026-04-16', '2026-06-10 14:00:00', 20000000, 55000000, 'Treasury requires modernization of government-wide financial management and accounting systems including ERP integration, audit trail compliance, and real-time reporting.', 'Parkersburg, WV', 'TFIS-26-R-0012', 38, 'Software development capability exists but financial management systems and ERP integration are not Apex specialties', 'new'],
      ['APEX-2026-010', 'Biometric Identity Management Platform', 'Department of Homeland Security', 'US Citizenship and Immigration Services', '541512', 'Full and Open', '2026-04-17', '2026-06-20 17:00:00', 30000000, 80000000, 'USCIS requires next-generation biometric identity management platform supporting facial recognition, fingerprint matching, and immigration status verification at scale.', 'Washington, DC', 'HSFE40-26-R-0099', 28, 'IT services NAICS matches but biometric/identity management and facial recognition are outside Apex core capabilities, very large contract size', 'new'],
    ];

    const oppIds = [];
    for (const opp of opps) {
      try {
        const r = await client.query(`
          INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency, naics_code, set_aside, posted_date, response_deadline, value_min, value_max, description, place_of_performance, solicitation_number, fit_score, fit_reason, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (sam_notice_id) DO UPDATE SET
            search_id = EXCLUDED.search_id, org_id = EXCLUDED.org_id, title = EXCLUDED.title,
            agency = EXCLUDED.agency, sub_agency = EXCLUDED.sub_agency, naics_code = EXCLUDED.naics_code,
            set_aside = EXCLUDED.set_aside, posted_date = EXCLUDED.posted_date, response_deadline = EXCLUDED.response_deadline,
            value_min = EXCLUDED.value_min, value_max = EXCLUDED.value_max, description = EXCLUDED.description,
            place_of_performance = EXCLUDED.place_of_performance, solicitation_number = EXCLUDED.solicitation_number,
            fit_score = EXCLUDED.fit_score, fit_reason = EXCLUDED.fit_reason, status = EXCLUDED.status
          RETURNING id
        `, [searchId, user.org_id, ...opp]);
        if (r.rows.length) oppIds.push(r.rows[0].id);
        results.opportunities++;
      } catch (e) { console.error('Opp insert error:', e.message); }
    }

    // ── 7. Prime Contractors ──
    const primes = [
      ['Booz Allen Hamilton', '1WAR4', 'BOOZHAMILUEI1', 'https://boozallen.com', '541512,541519,541611', 'ISO 27001, CMMI Level 3, FedRAMP High', 8900000000, 478, 'DOD, Intelligence, Civilian', 'Large', 91, 'Top-tier consulting, strong AI/ML and cybersecurity divisions seeking niche SB partners for set-aside work', 'outreach_sent', 'David Chen', 'd.chen@bah.com', 'Director of Teaming'],
      ['Leidos Holdings', '3BYT7', 'LEIDOSUEI0001', 'https://leidos.com', '541512,541519,541330', 'ISO 27001, CMMI Level 5, FedRAMP', 4500000000, 312, 'DOD, DHS, Intelligence Community', 'Large', 88, 'Major defense IT prime, actively expanding SB teaming partnerships in cloud and cyber verticals', 'researched', 'Sarah Mitchell', 's.mitchell@leidos.com', 'VP Small Business Programs'],
      ['SAIC', '80209', 'SAICCOMPUEI01', 'https://saic.com', '541512,541330,541715', 'ISO 20000, CMMI Level 5, SOC 2 Type II', 7200000000, 289, 'DOD, Intelligence, Space', 'Large', 82, 'Digital transformation leader aggressively building SB supplier base for cloud migration work', 'not_contacted', 'Jennifer Park', 'j.park@saic.com', 'Small Business Liaison Officer'],
      ['ManTech International', '61788', 'MANTECHUEI001', 'https://mantech.com', '541512,541519,561210', 'ISO 27001, NIST 800-171, CMMI Level 3', 2800000000, 156, 'DOD, Intelligence, Federal Civilian', 'Large', 79, 'Mid-tier prime with strong cyber operations focus, looking for DevSecOps subcontractors', 'not_contacted', 'Robert Taylor', 'r.taylor@mantech.com', 'VP Business Development'],
      ['Peraton', '5SZE0', 'PERATONUEI001', 'https://peraton.com', '541512,541519,517312', 'FedRAMP, ISO 27001, CMMI Level 5', 6800000000, 234, 'Intelligence, DOD, Civilian', 'Large', 85, 'Massive IC footprint, aggressively expanding SB partnerships for zero trust and FedRAMP work', 'researched', 'Amanda White', 'a.white@peraton.com', 'Teaming Coordinator'],
    ];

    for (const p of primes) {
      try {
        await client.query(`
          INSERT INTO primes (org_id, company_name, cage_code, uei, website, naics_codes, certifications, total_awards_value, award_count, agency_focus, size_category, fit_score, fit_reason, outreach_status, contact_name, contact_email, contact_title)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [user.org_id, ...p]);
        results.primes++;
      } catch (e) { console.error('Prime insert error:', e.message); }
    }

    // ── 8. Marketplace Teaming Opportunities — varied agencies and set-asides ──
    const shared = [
      ['DISA Cloud Migration — Need SB Cloud Partner', 'Booz Allen is priming a $15M DISA enterprise cloud migration. Looking for SB with AWS GovCloud migration experience to lead technical execution. Prime handles PMO and stakeholder engagement; sub leads migration sprints, IaC, and post-migration monitoring.', '541512', 'Small Business Set-Aside', 'Defense Information Systems Agency', '2026-04-25 17:00:00', 5000000, 15000000, 'Cloud Migration Lead, DevSecOps Engineer, Solutions Architect, Cloud Security Engineer', 'AWS GovCloud or Azure Gov experience required. FedRAMP familiarity. Secret clearance minimum. 3+ years DoD cloud migration experience.'],
      ['Army Cyber SOC — SDVOSB Teaming Partner Needed', 'Leidos seeking SDVOSB partner for Army Cyber Command SOC support. Need 24/7 SOC capability with threat hunting, incident response, and intelligence analysis. Strong past performance in DoD cyber operations required.', '541519', 'SDVOSB', 'Department of the Army', '2026-05-10 14:00:00', 12000000, 35000000, 'SOC Analysts (Tier 1-3), Threat Hunters, Incident Responders, Cyber Intel Analysts', 'SDVOSB certification required. TS/SCI clearances. Prior DOD SOC experience. Ability to staff 24/7 operations within 60 days.'],
      ['GSA Data Analytics Platform — Analytics Partner', 'SAIC priming GSA procurement analytics modernization. Seeking SB with data engineering and ML expertise for federal procurement dataset analysis, dashboard development, and predictive modeling.', '518210', 'Best Value', 'General Services Administration', '2026-05-05 12:00:00', 3000000, 10000000, 'Data Engineers, ML Engineers, BI Developers, Data Scientists', 'Federal procurement data experience preferred. Python/Spark/SQL required. FedRAMP helpful. Agile methodology.'],
      ['VA Telehealth Security Assessment — 8(a) Sub', 'Peraton priming VA telehealth platform security contract. Need 8(a) certified SB for security assessment, penetration testing, and HIPAA compliance validation of new telehealth infrastructure.', '541519', '8(a)', 'Department of Veterans Affairs', '2026-05-20 17:00:00', 2000000, 6000000, 'Penetration Testers, Security Assessors, Compliance Analysts', '8(a) certification required. HIPAA security experience strongly preferred. Healthcare IT background a plus.'],
      ['DHS Zero Trust Rollout — HUBZone Partner', 'ManTech leading DHS-wide zero trust architecture deployment. Seeking HUBZone SB for identity and access management implementation, microsegmentation design, and continuous verification engineering.', '541519', 'HUBZone', 'Department of Homeland Security', '2026-05-15 14:00:00', 8000000, 22000000, 'IAM Engineers, Network Security Architects, Zero Trust Engineers', 'HUBZone certified. Zero trust architecture experience (NIST SP 800-207). DHS or civilian agency experience preferred. Secret clearance.'],
    ];

    for (const s of shared) {
      try {
        await client.query(`
          INSERT INTO shared_opportunities (prime_user_id, title, description, naics_codes, set_aside, agency, response_deadline, value_min, value_max, roles_needed, requirements, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open')
        `, [user.id, ...s]);
        results.marketplace++;
      } catch (e) { console.error('Marketplace insert error:', e.message); }
    }

    // ── 9. Sequence Events — leads at every pipeline stage ──
    const allLeadIds = [...dodLeadIds, ...civLeadIds];
    const touchpoints = ['email1', 'linkedin_connect', 'call1', 'email2', 'call2', 'email3'];

    for (let i = 0; i < Math.min(allLeadIds.length, 15); i++) {
      const leadId = allLeadIds[i];
      // Spread across stages: first few leads completed full sequence, later ones just started
      const numTouches = i < 3 ? 6 : i < 6 ? 4 : i < 10 ? 2 : 1;

      for (let j = 0; j < numTouches; j++) {
        const touchpoint = touchpoints[j];
        const daysAgo = (numTouches - j) * 3 + Math.floor(Math.random() * 2);
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - daysAgo);

        try {
          await client.query(`
            INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, completed_at)
            VALUES ($1, $2, $3, 'done', $4)
            ON CONFLICT (lead_id, touchpoint) DO NOTHING
          `, [leadId, user.id, touchpoint, completedAt]);
          results.sequence_events++;
        } catch (e) { /* skip conflicts */ }
      }
    }
    // A few leads with 'pending' next touchpoint (scheduled but not done)
    for (let i = 15; i < Math.min(allLeadIds.length, 18); i++) {
      const leadId = allLeadIds[i];
      try {
        await client.query(`
          INSERT INTO sequence_events (lead_id, user_id, touchpoint, status)
          VALUES ($1, $2, 'email1', 'pending')
          ON CONFLICT (lead_id, touchpoint) DO NOTHING
        `, [leadId, user.id]);
        results.sequence_events++;
      } catch (e) { /* skip */ }
    }

    // ── 10. Proposals — 3 in different statuses ──
    if (oppIds.length >= 4) {
      const proposalData = [
        {
          opp_id: oppIds[0], // DISA Cloud Migration (fit 92)
          title: 'DISA Enterprise Cloud Migration — Technical & Management Proposal',
          status: 'submitted',
          deadline: '2026-05-01 17:00:00',
          estimated_value: 12500000,
          team_members: JSON.stringify([
            { name: 'Jack Morris', role: 'Capture Manager' },
            { name: 'Sarah Chen', role: 'Technical Lead' },
            { name: 'Mike Thompson', role: 'Solutions Architect' },
            { name: 'David Chen (BAH)', role: 'Teaming Partner POC' },
          ]),
          sections: JSON.stringify([
            { name: 'Executive Summary', status: 'complete', pages: 3 },
            { name: 'Technical Approach', status: 'complete', pages: 18 },
            { name: 'Management Approach', status: 'complete', pages: 12 },
            { name: 'Past Performance', status: 'complete', pages: 8 },
            { name: 'Cost Volume', status: 'complete', pages: 6 },
          ]),
          notes: 'Submitted 2 days ahead of deadline. Teaming with Booz Allen — they handle program management, we lead cloud migration execution. Strong past performance from DHS cloud work.',
        },
        {
          opp_id: oppIds[2], // FedRAMP Authorization (fit 90)
          title: 'GSA FedRAMP Authorization Support — Draft Proposal',
          status: 'drafting',
          deadline: '2026-05-10 14:00:00',
          estimated_value: 7500000,
          team_members: JSON.stringify([
            { name: 'Jack Morris', role: 'Proposal Manager' },
            { name: 'Patricia Jones', role: 'FedRAMP SME' },
          ]),
          sections: JSON.stringify([
            { name: 'Executive Summary', status: 'complete', pages: 2 },
            { name: 'Technical Approach', status: 'in_progress', pages: 8 },
            { name: 'Management Approach', status: 'not_started', pages: 0 },
            { name: 'Past Performance', status: 'not_started', pages: 0 },
            { name: 'Pricing', status: 'not_started', pages: 0 },
          ]),
          notes: 'Deadline in 30 days. Need to finalize technical approach section and identify 3 past performance references. Strong win probability given FedRAMP expertise.',
        },
        {
          opp_id: oppIds[3], // CISA SOC Support (fit 85)
          title: 'CISA Cybersecurity Operations Center — Capture Decision Review',
          status: 'review',
          deadline: '2026-05-15 17:00:00',
          estimated_value: 28000000,
          team_members: JSON.stringify([
            { name: 'Jack Morris', role: 'Capture Manager' },
            { name: 'Elizabeth Howard', role: 'Technical Advisor' },
            { name: 'Robert Garcia', role: 'Staffing Lead' },
          ]),
          sections: JSON.stringify([
            { name: 'Capture Plan', status: 'complete', pages: 5 },
            { name: 'Competitive Analysis', status: 'complete', pages: 3 },
            { name: 'Win Strategy', status: 'in_progress', pages: 2 },
            { name: 'Technical Approach Outline', status: 'not_started', pages: 0 },
          ]),
          notes: 'Bid/no-bid decision needed by April 20. SDVOSB set-aside is major advantage. Need to validate staffing for 24/7 ops — may require teaming with Leidos for bench depth.',
        },
      ];

      for (const p of proposalData) {
        try {
          await client.query(`
            INSERT INTO proposals (org_id, user_id, opportunity_id, title, status, deadline, team_members, sections, estimated_value, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [user.org_id, user.id, p.opp_id, p.title, p.status, p.deadline, p.team_members, p.sections, p.estimated_value, p.notes]);
          results.proposals++;
        } catch (e) { console.error('Proposal insert error:', e.message); }
      }
    }

    // ── 11. Competitive Intelligence — 2 entries ──
    if (oppIds.length >= 4) {
      const compIntel = [
        {
          competitor: 'Accenture Federal Services',
          opp_id: oppIds[0], // DISA Cloud Migration
          threat_level: 'high',
          notes: 'Accenture Federal has an existing DISA IDIQ and completed a similar $20M cloud migration for Army in 2025. They will likely bid aggressively on price.',
          strengths: 'Massive bench of cleared cloud engineers, existing DISA relationship, strong AWS partnership, can absorb cost risk on fixed-price tasks',
          weaknesses: 'Not a small business — cannot bid directly on SB set-aside. May try to partner with SB shell company. Their migration methodology is waterfall-heavy which DISA has pushed back on.',
          contract_value: 18000000,
          outcome: 'pending',
        },
        {
          competitor: 'Telos Corporation',
          opp_id: oppIds[3], // CISA SOC Support
          threat_level: 'medium',
          notes: 'Telos has CISA relationship from prior Xacta work but their SOC staffing capability is limited. They submitted a weak proposal on the predecessor contract and scored low on technical.',
          strengths: 'Existing CISA relationship from Xacta RM, cybersecurity focus, SDVOSB eligible through mentor-protege JV',
          weaknesses: 'Limited 24/7 SOC staffing experience, no dedicated threat hunting team, previous proposal scored below competitive range on technical approach',
          contract_value: 0,
          outcome: 'pending',
        },
      ];

      for (const ci of compIntel) {
        try {
          await client.query(`
            INSERT INTO competitive_intel (org_id, user_id, competitor_name, opportunity_id, threat_level, notes, strengths, weaknesses, contract_value, outcome)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [user.org_id, user.id, ci.competitor, ci.opp_id, ci.threat_level, ci.notes, ci.strengths, ci.weaknesses, ci.contract_value, ci.outcome]);
          results.competitive_intel++;
        } catch (e) { console.error('Competitive intel insert error:', e.message); }
      }
    }

    // ── 12. Notifications ──
    const notifications = [
      ['info', 'DISA Cloud Migration deadline in 23 days', 'Enterprise Cloud Migration Services response due May 1, 2026. Proposal status: submitted.', '/proposals'],
      ['warning', 'Zero Trust RFP closing in 20 days', 'Zero Trust Architecture Implementation (Air Force) deadline April 28. No proposal started — capture decision needed.', '/opportunities'],
      ['info', 'Teaming inquiry from Leidos', 'Leidos VP Sarah Mitchell expressed interest in partnering for Army Cyber SOC contract. Follow up to discuss staffing plan.', '/primes'],
      ['info', 'New SAM.gov match: HHS Network Security', 'Network Security Assessment Services (HHS) matches 62% of your capabilities. NAICS 541519, SB set-aside, $1.5M-$5M.', '/opportunities'],
      ['info', 'Weekly pipeline summary', 'This week: 10 opportunities tracked, 3 proposals active, 2 new SAM.gov matches. Pipeline value: $142M total, $65M high-fit.', '/dashboard'],
      ['warning', 'Follow up with Sarah Chen at DISA', 'Sarah Chen (Deputy CIO) opened your email 3 days ago but has not responded. Recommended: phone call follow-up.', '/leads'],
    ];

    for (const [type, title, message, link] of notifications) {
      try {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, link, is_read)
          VALUES ($1, $2, $3, $4, $5, false)
        `, [user.id, type, title, message, link]);
        results.notifications++;
      } catch (e) { console.error('Notification insert error:', e.message); }
    }

    // ── 13. Sub Profile — Apex Defense Solutions ──
    const profileRes = await client.query(
      'SELECT id FROM sub_profiles WHERE org_id = $1',
      [user.org_id]
    );

    const profileData = {
      company_name: 'Apex Defense Solutions LLC',
      website_url: 'https://apexdefensesolutions.com',
      naics_codes: '541512,541511,541519,518210,561210',
      cage_code: '8K7N2',
      uei: 'J7K9LM2N3P4Q',
      certifications: 'ISO 27001, CMMI Level 3, FedRAMP Authorized (Moderate), NIST 800-171 Compliant, SOC 2 Type II',
      tagline: 'Cloud migration, cybersecurity, and DevSecOps for federal agencies',
      capabilities: 'Enterprise Cloud Migration (AWS GovCloud, Azure Government), Cybersecurity Operations Center (SOC) Services, DevSecOps Platform Engineering & CI/CD, FedRAMP Authorization & Continuous Monitoring, Zero Trust Architecture Design & Implementation, Legacy System Modernization & API Development, Security Assessment & Penetration Testing, Compliance Consulting (FISMA, NIST, HIPAA)',
      target_agencies: 'Department of Defense, DHS/CISA, Department of Veterans Affairs, DOE, GSA, Intelligence Community',
      set_aside_prefs: 'SDVOSB (Service-Disabled Veteran-Owned Small Business), 8(a) Certified, HUBZone Eligible',
    };

    if (profileRes.rows.length > 0) {
      await client.query(`
        UPDATE sub_profiles SET
          company_name=$1, website_url=$2, naics_codes=$3, cage_code=$4, uei=$5,
          certifications=$6, is_public=true, tagline=$7, capabilities=$8, target_agencies=$9, set_aside_prefs=$10
        WHERE org_id = $11
      `, [profileData.company_name, profileData.website_url, profileData.naics_codes, profileData.cage_code, profileData.uei, profileData.certifications, profileData.tagline, profileData.capabilities, profileData.target_agencies, profileData.set_aside_prefs, user.org_id]);
    } else {
      await client.query(`
        INSERT INTO sub_profiles (user_id, org_id, company_name, website_url, naics_codes, cage_code, uei, certifications, is_public, tagline, capabilities, target_agencies, set_aside_prefs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12)
      `, [user.id, user.org_id, profileData.company_name, profileData.website_url, profileData.naics_codes, profileData.cage_code, profileData.uei, profileData.certifications, profileData.tagline, profileData.capabilities, profileData.target_agencies, profileData.set_aside_prefs]);
    }
    results.profile = true;

    // ══════════════════════════════════════════════
    // NEW MODULE SEED DATA (Batch 1-3 features)
    // ══════════════════════════════════════════════

    // Clean new module data
    await client.query(`DELETE FROM govcon_events WHERE org_id = $1 OR is_global = true`, [user.org_id]);
    await client.query(`DELETE FROM contract_vehicles WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM gov_contacts WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM capture_items WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM compliance_items WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM foia_requests WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM subcon_plans WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM market_research_reports WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM bid_decisions WHERE org_id = $1`, [user.org_id]);
    await client.query(`DELETE FROM revenue_entries WHERE org_id = $1`, [user.org_id]);

    results.events = 0;
    results.contract_vehicles = 0;
    results.gov_contacts = 0;
    results.capture_items = 0;
    results.compliance_items = 0;
    results.foia_requests = 0;
    results.subcon_plans = 0;
    results.market_research = 0;
    results.bid_decisions = 0;

    // ── EVENTS ──
    const events = [
      { title: 'AFCEA TechNet Cyber', event_type: 'conference', agency: 'Department of Defense', location: 'Baltimore, MD', start_date: '2026-05-05', end_date: '2026-05-07', description: 'Premier DoD cybersecurity conference with exhibits and technical panels' },
      { title: 'PSC Vision Federal Market Forecast', event_type: 'conference', agency: null, location: 'Washington, DC', start_date: '2026-06-10', end_date: '2026-06-11', description: 'Industry forecast for federal IT spending and acquisition trends' },
      { title: 'GovConWire GovCon Summit', event_type: 'conference', agency: null, location: 'Tysons Corner, VA', start_date: '2026-04-22', end_date: '2026-04-22', description: 'Executive-level networking and panel discussions on GovCon trends' },
      { title: 'DHS Industry Day — Cybersecurity Services BPA', event_type: 'industry_day', agency: 'Department of Homeland Security', location: 'Virtual', start_date: '2026-04-28', end_date: '2026-04-28', description: 'Pre-solicitation industry day for upcoming CISA cybersecurity BPA' },
      { title: 'Army IT Infrastructure Modernization Industry Day', event_type: 'industry_day', agency: 'Department of Defense', location: 'Fort Belvoir, VA', start_date: '2026-05-15', end_date: '2026-05-15', description: 'Army CIO briefing on cloud migration and zero trust architecture requirements' },
      { title: 'OSDBU Small Business Conference', event_type: 'conference', agency: 'General Services Administration', location: 'Washington, DC', start_date: '2026-06-03', end_date: '2026-06-04', description: 'Annual small business matchmaking and capability briefings' },
      { title: 'VA EHR Modernization Vendor Forum', event_type: 'industry_day', agency: 'Department of Veterans Affairs', location: 'Virtual', start_date: '2026-03-18', end_date: '2026-03-18', description: 'VA OEHRM quarterly vendor engagement on Oracle Health EHR deployment' },
      { title: 'NIST Cybersecurity Framework Workshop', event_type: 'webinar', agency: null, location: 'Virtual', start_date: '2026-05-20', end_date: '2026-05-20', description: 'NIST-led workshop on CSF 2.0 implementation and CMMC alignment' },
      { title: 'Air Force SBIR/STTR Pitch Day', event_type: 'networking', agency: 'Department of Defense', location: 'Wright-Patterson AFB, OH', start_date: '2026-07-14', end_date: '2026-07-15', description: 'Fast-track pitch event for innovative small business technology solutions' },
      { title: 'HHS Data Analytics Pre-Solicitation Conference', event_type: 'industry_day', agency: 'Department of Health and Human Services', location: 'Bethesda, MD', start_date: '2026-04-16', end_date: '2026-04-16', description: 'Upcoming $200M data analytics platform modernization' },
    ];
    for (const e of events) {
      await client.query(
        `INSERT INTO govcon_events (org_id, title, event_type, agency, location, start_date, end_date, description, rsvp_status, is_global)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
        [user.org_id, e.title, e.event_type, e.agency, e.location, e.start_date, e.end_date, e.description, e.rsvp_status || 'none']
      );
      results.events++;
    }

    // ── CONTRACT VEHICLES ──
    const vehicles = [
      { name: 'GSA MAS (Multiple Award Schedule)', vehicle_type: 'GSA Schedule', contract_number: 'GS-35F-0521T', agency: 'General Services Administration', ceiling_value: 25000000, current_value: 8500000, start_date: '2022-06-01', end_date: '2027-05-31', option_years: 3, naics_codes: '["541512","541511","541519"]', status: 'active' },
      { name: 'CIO-SP3 Small Business', vehicle_type: 'GWAC', contract_number: 'HHSN316201500055W', agency: 'National Institutes of Health', ceiling_value: 20000000000, current_value: null, start_date: '2019-05-01', end_date: '2029-04-30', option_years: 0, naics_codes: '["541512","541511","518210"]', status: 'active' },
      { name: 'Alliant 2 Small Business', vehicle_type: 'GWAC', contract_number: '47QTCK18D0001', agency: 'General Services Administration', ceiling_value: 15000000000, current_value: null, start_date: '2018-07-01', end_date: '2028-06-30', option_years: 0, naics_codes: '["541512","541519","541330"]', status: 'active' },
      { name: 'SEWP V', vehicle_type: 'GWAC', contract_number: 'NNG15SC35B', agency: 'NASA', ceiling_value: 50000000000, current_value: null, start_date: '2015-05-01', end_date: '2025-04-30', option_years: 0, naics_codes: '["334111","541512"]', status: 'expiring' },
      { name: 'OASIS SB Pool 1', vehicle_type: 'IDIQ', contract_number: '47QRAA20D0001', agency: 'General Services Administration', ceiling_value: 60000000000, current_value: null, start_date: '2020-07-01', end_date: '2030-06-30', option_years: 5, naics_codes: '["541611","541512","541330"]', status: 'active' },
      { name: '8(a) STARS III', vehicle_type: 'GWAC', contract_number: '47QTCB21D0001', agency: 'General Services Administration', ceiling_value: 50000000000, current_value: null, start_date: '2021-07-02', end_date: '2029-07-01', option_years: 0, naics_codes: '["541512","541511","541519"]', status: 'active' },
      { name: 'DHS EAGLE II', vehicle_type: 'IDIQ', contract_number: 'HSHQDC-13-D-E2001', agency: 'Department of Homeland Security', ceiling_value: 22000000000, current_value: 3200000, start_date: '2014-09-01', end_date: '2025-08-31', option_years: 0, naics_codes: '["541512","541519"]', status: 'expiring' },
    ];
    for (const v of vehicles) {
      await client.query(
        `INSERT INTO contract_vehicles (org_id, name, vehicle_type, contract_number, agency, ceiling_value, current_value, start_date, end_date, option_years, naics_codes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
        [user.org_id, v.name, v.vehicle_type, v.contract_number, v.agency, v.ceiling_value, v.current_value, v.start_date, v.end_date, v.option_years, v.naics_codes, v.status]
      );
      results.contract_vehicles++;
    }

    // ── GOV CONTACTS ──
    const contacts = [
      { name: 'Col. James Peterson', title: 'Program Manager, Army Cyber Command', agency: 'Department of Defense', office: 'ARCYBER G-6', email: 'james.peterson@army.mil', phone: '703-555-0142', notes: 'Key contact for network defense programs. Met at AFCEA 2025.', last_interaction: '2026-03-15', interaction_count: 5 },
      { name: 'Sarah Chen', title: 'Contracting Officer', agency: 'Department of Homeland Security', office: 'CISA Acquisitions', email: 'sarah.chen@cisa.dhs.gov', phone: '202-555-0198', notes: 'Manages cyber services BPA. Responsive to capability statements.', last_interaction: '2026-04-01', interaction_count: 3 },
      { name: 'Dr. Michael Torres', title: 'Chief Information Officer', agency: 'Department of Veterans Affairs', office: 'Office of Information Technology', email: 'michael.torres@va.gov', phone: '202-555-0237', notes: 'Driving EHR modernization. Interested in data migration solutions.', last_interaction: '2026-02-20', interaction_count: 2 },
      { name: 'Patricia Williams', title: 'Deputy CTO', agency: 'Department of Health and Human Services', office: 'OCIO', email: 'patricia.williams@hhs.gov', phone: '202-555-0305', notes: 'Oversees cloud-first strategy. Budget authority for data analytics.', last_interaction: '2026-03-28', interaction_count: 4 },
      { name: 'Robert Kim', title: 'Small Business Specialist', agency: 'General Services Administration', office: 'OSDBU', email: 'robert.kim@gsa.gov', phone: '202-555-0176', notes: 'Helpful with GSA Schedule and OASIS questions. Annual conference organizer.', last_interaction: '2026-04-05', interaction_count: 8 },
      { name: 'LCDR Nicole Davis', title: 'IT Acquisitions Lead', agency: 'Department of Defense', office: 'NAVSEA', email: 'nicole.davis@navy.mil', phone: '703-555-0289', notes: 'Manages $50M+ IT modernization portfolio. Prefers technical white papers.', last_interaction: '2026-01-10', interaction_count: 2 },
      { name: 'Ahmad Hassan', title: 'Program Analyst', agency: 'Department of Defense', office: 'DISA', email: 'ahmad.hassan@disa.mil', phone: '301-555-0154', notes: 'Zero trust implementation lead. Connected us to milCloud program.', last_interaction: '2026-03-22', interaction_count: 6 },
      { name: 'Jennifer Lopez-Rivera', title: 'Contracting Officer Representative', agency: 'Department of Energy', office: 'NNSA', email: 'jennifer.lopezrivera@nnsa.doe.gov', phone: '505-555-0211', notes: 'Oversees classified computing contracts. ITAR-cleared programs.', last_interaction: '2026-02-14', interaction_count: 1 },
      { name: 'David Washington', title: 'Branch Chief, Cloud Services', agency: 'Department of Defense', office: 'Pentagon OCIO', email: 'david.washington@osd.mil', phone: '703-555-0322', notes: 'JWCC decision-maker. Strong advocate for multi-cloud strategy.', last_interaction: '2026-04-02', interaction_count: 3 },
      { name: 'Maria Gonzalez', title: 'Deputy Director, IT Modernization', agency: 'Department of Homeland Security', office: 'CBP', email: 'maria.gonzalez@cbp.dhs.gov', phone: '202-555-0267', notes: 'Leading border technology upgrades. $80M program in planning.', last_interaction: '2026-03-10', interaction_count: 4 },
      { name: 'Thomas Anderson', title: 'Contracting Officer', agency: 'Department of Defense', office: 'Air Force LCMC', email: 'thomas.anderson@us.af.mil', phone: '937-555-0199', notes: 'Wright-Patterson contracting. Manages SBIR/STTR evaluations.', last_interaction: '2026-01-28', interaction_count: 2 },
      { name: 'Lisa Park', title: 'Chief Data Officer', agency: 'Department of Health and Human Services', office: 'CDC', email: 'lisa.park@cdc.gov', phone: '404-555-0143', notes: 'Manages data platform modernization. FY26 $35M budget for analytics.', last_interaction: '2026-03-05', interaction_count: 3 },
    ];
    for (const c of contacts) {
      await client.query(
        `INSERT INTO gov_contacts (org_id, name, title, agency, office, email, phone, notes, last_interaction, interaction_count, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]'::jsonb)`,
        [user.org_id, c.name, c.title, c.agency, c.office, c.email, c.phone, c.notes, c.last_interaction, c.interaction_count]
      );
      results.gov_contacts++;
    }

    // ── CAPTURE ITEMS ──
    const captures = [
      { title: 'DHS CISA Cybersecurity Services BPA', phase: 'capture', pwin: 55, estimated_value: 12000000, notes: 'Strong incumbent relationship. Solution architecture in progress.', go_no_go: 'go' },
      { title: 'Army Network Modernization - Cyber Defense', phase: 'qualify', pwin: 35, estimated_value: 48000000, notes: 'Large program. Need teaming partner with TS/SCI cleared staff.', go_no_go: null },
      { title: 'VA Data Migration & Analytics Platform', phase: 'proposal', pwin: 70, estimated_value: 8500000, notes: 'Proposal due June 15. Technical volume drafted. Past performance strong.', go_no_go: 'go' },
      { title: 'HHS Cloud Infrastructure Modernization', phase: 'lead', pwin: 15, estimated_value: 25000000, notes: 'Early stage. RFI expected Q3 FY26. Building agency relationships.', go_no_go: null },
      { title: 'DISA Zero Trust Architecture Implementation', phase: 'capture', pwin: 45, estimated_value: 35000000, notes: 'Teaming with Booz Allen. Gate review passed. Pricing model being developed.', go_no_go: 'go' },
      { title: 'CBP Border Technology Upgrades', phase: 'qualify', pwin: 25, estimated_value: 4800000, notes: 'Small business set-aside. Matches 541512 NAICS. Investigating past performance gap.', go_no_go: null },
    ];
    for (const cap of captures) {
      const gateCriteria = { lead: ['Funded?','Matches capabilities?','Worth pursuing?'], qualify: ['Customer access?','Past performance?','Know incumbent?'], capture: ['Solution defined?','Team identified?','Price competitive?'], proposal: ['Compliant?','Reviewed?','Competitive?'] };
      await client.query(
        `INSERT INTO capture_items (org_id, user_id, title, phase, pwin, estimated_value, gate_criteria, notes, go_no_go)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.org_id, user.id, cap.title, cap.phase, cap.pwin, cap.estimated_value, JSON.stringify(gateCriteria[cap.phase] || []), cap.notes, cap.go_no_go]
      );
      results.capture_items++;
    }

    // ── COMPLIANCE ITEMS ──
    const compItems = [
      { requirement_key: 'sam_registration', category: 'Registrations', status: 'pass', expiration_date: '2027-03-15', notes: 'SAM.gov registration active. Renewal March 2027.' },
      { requirement_key: 'far_52_204_21', category: 'FAR/DFARS', status: 'pass', expiration_date: null, notes: 'Basic safeguarding of covered contractor information. Implemented.' },
      { requirement_key: 'dfars_252_204_7012', category: 'FAR/DFARS', status: 'in_progress', expiration_date: null, notes: 'Cyber incident reporting. NIST 800-171 assessment in progress.' },
      { requirement_key: 'cmmc_level_1', category: 'CMMC', status: 'pass', expiration_date: '2027-01-01', notes: 'Level 1 self-assessment complete. 17 practices verified.' },
      { requirement_key: 'cmmc_level_2', category: 'CMMC', status: 'in_progress', expiration_date: null, notes: 'C3PAO assessment scheduled for July 2026. 78/110 practices implemented.' },
      { requirement_key: 'cui_handling', category: 'CUI', status: 'in_progress', expiration_date: null, notes: 'CUI marking and handling procedures drafted. Training 60% complete.' },
      { requirement_key: 'section_508', category: 'Section 508', status: 'pass', expiration_date: null, notes: 'VPAT completed for all deliverable software. WCAG 2.1 AA compliant.' },
      { requirement_key: 'itar_compliance', category: 'ITAR', status: 'not_started', expiration_date: null, notes: 'Not currently required. Will need for DISA contract if awarded.' },
      { requirement_key: 'dcaa_audit', category: 'Registrations', status: 'pass', expiration_date: '2026-12-31', notes: 'Incurred cost audit passed. Accounting system approved.' },
      { requirement_key: 'iso_27001', category: 'FAR/DFARS', status: 'in_progress', expiration_date: null, notes: 'ISO 27001 certification in progress. Stage 1 audit complete.' },
    ];
    for (const ci of compItems) {
      await client.query(
        `INSERT INTO compliance_items (org_id, requirement_key, category, status, expiration_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.org_id, ci.requirement_key, ci.category, ci.status, ci.expiration_date, ci.notes]
      );
      results.compliance_items++;
    }

    // ── FOIA REQUESTS ──
    const foiaReqs = [
      { title: 'Incumbent pricing on DHS CISA Cyber BPA', agency: 'Department of Homeland Security', template_type: 'pricing', status: 'submitted', tracking_number: 'DHS-2026-FOIA-04521', submitted_date: '2026-02-10', notes: 'Requested full pricing volume from incumbent contract N6523419C0045.' },
      { title: 'Past performance evaluation — Army NetMod', agency: 'Department of Defense', template_type: 'past_performance', status: 'processing', tracking_number: 'DOD-2026-FOIA-11892', submitted_date: '2026-01-15', notes: 'Requested past performance evaluation of Leidos on Army Network contract.' },
      { title: 'VA EHRM contract modifications FY25', agency: 'Department of Veterans Affairs', template_type: 'contract_modifications', status: 'completed', tracking_number: 'VA-2026-FOIA-00892', submitted_date: '2025-11-20', response_date: '2026-03-01', notes: 'Received 47 pages of contract modifications. Key intel on scope changes.' },
      { title: 'CBP border tech RFP evaluation criteria', agency: 'Department of Homeland Security', template_type: 'competitor_proposals', status: 'draft', notes: 'Draft request for evaluation criteria and scoring from prior CBP tech procurement.' },
    ];
    for (const f of foiaReqs) {
      await client.query(
        `INSERT INTO foia_requests (org_id, user_id, title, agency, template_type, status, tracking_number, submitted_date, response_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [user.org_id, user.id, f.title, f.agency, f.template_type, f.status, f.tracking_number || null, f.submitted_date || null, f.response_date || null, f.notes]
      );
      results.foia_requests++;
    }

    // ── SUBCONTRACTING PLANS ──
    const subPlans = [
      { title: 'DHS CISA Cybersecurity BPA — SubCon Plan', contract_value: 12000000, sb_goal_pct: 35, sdb_goal_pct: 8, wosb_goal_pct: 6, hubzone_goal_pct: 4, sdvosb_goal_pct: 5, identified_subs: '[{"name":"CyberShield Solutions","type":"8(a) SDB","naics":"541512","value":1200000},{"name":"SecureNet Women-Owned","type":"WOSB","naics":"541519","value":720000}]', status: 'draft' },
      { title: 'Army Network Modernization — SubCon Plan', contract_value: 48000000, sb_goal_pct: 23, sdb_goal_pct: 5, wosb_goal_pct: 5, hubzone_goal_pct: 3, sdvosb_goal_pct: 3, identified_subs: '[{"name":"VetTech Cyber","type":"SDVOSB","naics":"541512","value":2400000},{"name":"HubZone IT Solutions","type":"HUBZone","naics":"541511","value":1440000},{"name":"Minority Tech Partners","type":"SDB","naics":"541330","value":2400000}]', status: 'draft' },
    ];
    for (const sp of subPlans) {
      await client.query(
        `INSERT INTO subcon_plans (org_id, title, contract_value, sb_goal_pct, sdb_goal_pct, wosb_goal_pct, hubzone_goal_pct, sdvosb_goal_pct, identified_subs, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [user.org_id, sp.title, sp.contract_value, sp.sb_goal_pct, sp.sdb_goal_pct, sp.wosb_goal_pct, sp.hubzone_goal_pct, sp.sdvosb_goal_pct, sp.identified_subs, sp.status]
      );
      results.subcon_plans++;
    }

    // ── MARKET RESEARCH REPORTS ──
    const mrReports = [
      { title: 'NAICS 541512 — Computer Systems Design Services Market Analysis', naics: '541512', agency: 'Department of Defense', content: '## Market Overview\n\nThe Computer Systems Design Services market (NAICS 541512) represents one of the largest federal IT spending categories, with $18.2B in obligations in FY2025. The DoD accounts for approximately 45% of total spend.\n\n## Key Trends\n\nCloud migration continues to drive growth, with DoD JWCC and CIA C2E contracts leading the way. Zero trust architecture mandates (per EO 14028) are creating new opportunities in network security and identity management.\n\n## Competitive Landscape\n\nTop contractors by revenue: Leidos ($4.2B), Booz Allen Hamilton ($3.8B), SAIC ($2.9B), Perspecta/Peraton ($2.1B). Small business share has grown to 28% in FY2025.\n\n## Opportunities\n\n$3.4B in upcoming recompetes identified for FY2026-2027. Key programs include Army network modernization ($2.1B), DISA infrastructure ($890M), and VA data analytics ($350M).\n\n## Recommendations\n\nFocus on zero trust and cloud migration capabilities. Build past performance in DoD cyber. Consider teaming with established primes for larger opportunities while pursuing 8(a) and SDVOSB set-asides independently.' },
      { title: 'NAICS 541519 — Other Computer Related Services (HHS Focus)', naics: '541519', agency: 'Department of Health and Human Services', content: '## Market Overview\n\nNAICS 541519 covers IT services not classified elsewhere, including data analytics, AI/ML, and specialized technical services. HHS spent $2.8B in this category in FY2025.\n\n## Agency Analysis: HHS\n\nCDC data modernization ($1.1B program) is the largest initiative. CMS continues to invest in Medicare/Medicaid fraud detection using AI. NIH research computing represents a growing segment.\n\n## Small Business Landscape\n\nSmall business participation at 34% — above governmentwide average. 8(a) and WOSB set-asides are common. CIO-SP3 SB is the preferred vehicle.\n\n## Forecast\n\nExpect $450M in new procurements in FY2026, primarily in data analytics and AI/ML platforms. HHS is consolidating its data infrastructure, creating opportunities for firms with both technical depth and healthcare domain expertise.' },
      { title: 'Cybersecurity Services Market — Cross-Agency Analysis', naics: '541512', agency: null, content: '## Executive Summary\n\nFederal cybersecurity spending reached $22.8B in FY2025, up 12% from FY2024. This growth is driven by CMMC implementation, zero trust mandates, and increased threat landscape.\n\n## Spending by Agency\n\nDoD: $10.2B (45%), DHS/CISA: $3.1B (14%), Intelligence Community: $2.8B (12%), Civilian agencies: $6.7B (29%).\n\n## Market Dynamics\n\nThe shift to managed security services and security-as-a-service models is accelerating. Endpoint detection and response (EDR), security orchestration (SOAR), and cloud security posture management (CSPM) are fastest-growing segments.\n\n## Entry Strategy\n\nFor small businesses: target DHS CISA set-asides and DoD SBIR programs. Build CMMC Level 2 certification as a differentiator. Partner with large primes on enterprise programs while pursuing $5-15M standalone opportunities.' },
    ];
    for (const mr of mrReports) {
      await client.query(
        `INSERT INTO market_research_reports (org_id, user_id, title, naics, agency, content)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.org_id, user.id, mr.title, mr.naics, mr.agency, mr.content]
      );
      results.market_research++;
    }

    // ── BID DECISIONS ──
    const bidDecisions = [
      { title: 'DHS CISA Cybersecurity Services BPA', criteria: '{"strategic_fit":5,"technical_capability":4,"past_performance":4,"pricing_competitiveness":4,"competition_level":3,"timeline_feasibility":4,"resource_availability":4}', total_score: 82, recommendation: 'bid', decision: 'bid', decision_date: '2026-01-20', rationale: 'Strong strategic fit with our core cyber capabilities. Past performance on similar DHS work. Pricing competitive based on rate benchmarks. Proceed to capture phase.' },
      { title: 'Army Network Modernization', criteria: '{"strategic_fit":4,"technical_capability":3,"past_performance":2,"pricing_competitiveness":3,"competition_level":2,"timeline_feasibility":3,"resource_availability":3}', total_score: 58, recommendation: 'consider', decision: 'bid', decision_date: '2026-02-05', rationale: 'Large opportunity with growth potential but gaps in past performance. Decision to bid contingent on securing teaming partner with Army network experience.' },
      { title: 'IRS Tax Processing System Rewrite', criteria: '{"strategic_fit":2,"technical_capability":3,"past_performance":1,"pricing_competitiveness":2,"competition_level":1,"timeline_feasibility":2,"resource_availability":2}', total_score: 36, recommendation: 'no_bid', decision: 'no_bid', decision_date: '2026-02-28', rationale: 'No relevant past performance in tax systems. Heavy competition from incumbents. Resource requirements exceed current capacity. Focus efforts on DHS and DoD opportunities.' },
      { title: 'VA Data Migration & Analytics', criteria: '{"strategic_fit":5,"technical_capability":5,"past_performance":4,"pricing_competitiveness":4,"competition_level":4,"timeline_feasibility":4,"resource_availability":5}', total_score: 90, recommendation: 'bid', decision: 'bid', decision_date: '2026-03-12', rationale: 'Excellent fit. Strong past performance on similar VA data work. Competitive pricing with high win probability. Small business set-aside reduces competition.' },
    ];
    for (const bd of bidDecisions) {
      await client.query(
        `INSERT INTO bid_decisions (org_id, user_id, title, criteria, total_score, recommendation, decision, decision_date, rationale)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
        [user.org_id, user.id, bd.title, bd.criteria, bd.total_score, bd.recommendation, bd.decision, bd.decision_date, bd.rationale]
      );
      results.bid_decisions++;
    }

    // ── REVENUE ENTRIES (actuals for past months) ──
    const revenueEntries = [
      { title: 'GSA MAS Task Order — DHS CISA', amount: 450000, month: '2026-01-01', source: 'contract', is_actual: true },
      { title: 'GSA MAS Task Order — DHS CISA', amount: 450000, month: '2026-02-01', source: 'contract', is_actual: true },
      { title: 'GSA MAS Task Order — DHS CISA', amount: 450000, month: '2026-03-01', source: 'contract', is_actual: true },
      { title: 'VA Data Analytics Support', amount: 180000, month: '2026-02-01', source: 'contract', is_actual: true },
      { title: 'VA Data Analytics Support', amount: 180000, month: '2026-03-01', source: 'contract', is_actual: true },
      { title: 'DISA Consulting Engagement', amount: 95000, month: '2026-03-01', source: 'contract', is_actual: true },
    ];
    for (const re of revenueEntries) {
      await client.query(
        `INSERT INTO revenue_entries (org_id, title, amount, month, source, is_actual)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.org_id, re.title, re.amount, re.month, re.source, re.is_actual]
      );
    }

    res.json({ success: true, summary: results });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

module.exports = router;
