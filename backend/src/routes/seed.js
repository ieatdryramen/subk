const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// POST /api/seed/demo - Load comprehensive GovCon demo data (admin only)
router.post('/demo', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Verify admin
    const userR = await client.query('SELECT id, org_id, role FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const results = {
      lead_lists: 0,
      leads: 0,
      opportunities: 0,
      primes: 0,
      marketplace: 0,
      sequence_events: 0,
      notifications: 0,
      profile: false
    };

    // Wipe demo data if it exists
    await client.query(`DELETE FROM lead_lists WHERE user_id = $1 AND name LIKE 'DOD%' OR name LIKE 'Civilian%'`, [user.id]);
    await client.query(`DELETE FROM opportunities WHERE org_id = $1 AND title LIKE 'Enterprise Cloud%' OR title LIKE 'Zero Trust%' OR title LIKE 'IT Modernization%' OR title LIKE 'Cybersecurity Operations%' OR title LIKE 'Federal Data%' OR title LIKE 'Secure Communications%' OR title LIKE 'AI/ML Platform%' OR title LIKE 'Cloud-Based ERP%'`, [user.org_id]);
    await client.query(`DELETE FROM notifications WHERE user_id = $1 AND title LIKE 'Cloud Migration%' OR title LIKE 'Follow up with%' OR title LIKE 'New opportunity%' OR title LIKE 'Teaming request%' OR title LIKE 'Weekly%'`, [user.id]);

    // 1. Create lead lists
    const listRes1 = await client.query(`
      INSERT INTO lead_lists (user_id, org_id, name, description)
      VALUES ($1, $2, 'DOD Cyber Contacts', 'Defense agency CISO, CTO, and Program Manager contacts')
      RETURNING id
    `, [user.id, user.org_id]);
    const list1Id = listRes1.rows[0].id;
    results.lead_lists++;

    const listRes2 = await client.query(`
      INSERT INTO lead_lists (user_id, org_id, name, description)
      VALUES ($1, $2, 'Civilian Agency IT', 'IT decision-makers at civilian agencies')
      RETURNING id
    `, [user.id, user.org_id]);
    const list2Id = listRes2.rows[0].id;
    results.lead_lists++;

    // 2. Insert leads - DOD Cyber Contacts
    const dodLeads = [
      ['James Rodriguez', 'Defense Information Systems Agency', 'CISO', 'james.rodriguez@disa.mil', 'https://linkedin.com/in/jrodriguez', 'Reston, VA', 85],
      ['Sarah Chen', 'Defense Information Systems Agency', 'Deputy CIO', 'sarah.chen@disa.mil', 'https://linkedin.com/in/schen', 'Fort Meade, MD', 92],
      ['Michael Thompson', 'US Air Force', 'Chief Technology Officer', 'michael.thompson@af.mil', 'https://linkedin.com/in/mthompson', 'Arlington, VA', 88],
      ['Jennifer Williams', 'US Army Cyber Command', 'Director of Operations', 'jennifer.williams@arcyber.army.mil', 'https://linkedin.com/in/jwilliams', 'Fort Gordon, GA', 78],
      ['David Park', 'US Navy Cyber Security Center', 'Program Manager', 'david.park@navy.mil', 'https://linkedin.com/in/dpark', 'Norfolk, VA', 80],
      ['Amanda Foster', 'DoD Information Security', 'Contracting Officer', 'amanda.foster@defense.gov', 'https://linkedin.com/in/afoster', 'Washington, DC', 75],
      ['Robert Garcia', 'Joint Special Operations Command', 'IT Director', 'robert.garcia@socom.mil', 'https://linkedin.com/in/rgarcia', 'MacDill AFB, FL', 82],
      ['Lisa Murphy', 'Defense Cyber Crime Center', 'Senior Analyst', 'lisa.murphy@dc3.mil', 'https://linkedin.com/in/lmurphy', 'Glynco, GA', 76],
      ['Christopher Lee', 'NSA Cybersecurity Collaboration Center', 'Program Manager', 'christopher.lee@nsa.gov', 'https://linkedin.com/in/clee', 'Fort Meade, MD', 89],
      ['Patricia Jones', 'US Marine Corps', 'Chief Information Officer', 'patricia.jones@usmc.mil', 'https://linkedin.com/in/pjones', 'Quantico, VA', 81],
      ['Mark Bennett', 'Defense Threat Reduction Agency', 'Director of Technology', 'mark.bennett@dtra.mil', 'https://linkedin.com/in/mbennett', 'Fort Belvoir, VA', 77],
      ['Elizabeth Howard', 'Cyber Command', 'Strategic Director', 'elizabeth.howard@cybercom.mil', 'https://linkedin.com/in/ehoward', 'Fort Meade, MD', 90],
    ];

    for (const [name, company, title, email, linkedin, notes, icp] of dodLeads) {
      const leadRes = await client.query(`
        INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes, status, icp_score, engagement_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'done', $9, 'active')
        RETURNING id
      `, [list1Id, user.id, name, company, title, email, linkedin, notes, icp]);
      results.leads++;
    }

    // 3. Insert leads - Civilian Agency IT
    const civilianLeads = [
      ['Kevin Stewart', 'Department of Homeland Security', 'CISO', 'kevin.stewart@dhs.gov', 'https://linkedin.com/in/kstewart', 'Washington, DC', 87],
      ['Angela Mitchell', 'Veterans Affairs', 'Deputy CIO', 'angela.mitchell@va.gov', 'https://linkedin.com/in/amitchell', 'Washington, DC', 84],
      ['Thomas Bailey', 'Department of Energy', 'IT Director', 'thomas.bailey@doe.gov', 'https://linkedin.com/in/tbailey', 'Washington, DC', 79],
      ['Rachel Green', 'General Services Administration', 'Program Manager', 'rachel.green@gsa.gov', 'https://linkedin.com/in/rgreen', 'Washington, DC', 81],
      ['Steven Martinez', 'Department of Health and Human Services', 'Contracting Officer', 'steven.martinez@hhs.gov', 'https://linkedin.com/in/smartinez', 'Rockville, MD', 74],
      ['Laura Adams', 'Department of Agriculture', 'Chief Technology Officer', 'laura.adams@usda.gov', 'https://linkedin.com/in/ladams', 'Washington, DC', 77],
      ['George Walker', 'Social Security Administration', 'IT Director', 'george.walker@ssa.gov', 'https://linkedin.com/in/gwalker', 'Baltimore, MD', 70],
      ['Carol Davis', 'Environmental Protection Agency', 'Deputy Director IT', 'carol.davis@epa.gov', 'https://linkedin.com/in/cdavis', 'Washington, DC', 72],
      ['Edward Clark', 'Treasury Department', 'Senior IT Manager', 'edward.clark@treasury.gov', 'https://linkedin.com/in/eclark', 'Washington, DC', 68],
      ['Margaret Taylor', 'Office of Personnel Management', 'CISO', 'margaret.taylor@opm.gov', 'https://linkedin.com/in/mtaylor', 'Washington, DC', 76],
    ];

    for (const [name, company, title, email, linkedin, notes, icp] of civilianLeads) {
      const leadRes = await client.query(`
        INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes, status, icp_score, engagement_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'done', $9, 'active')
        RETURNING id
      `, [list2Id, user.id, name, company, title, email, linkedin, notes, icp]);
      results.leads++;
    }

    // 4. Create opportunity search
    let searchId;
    const searchRes = await client.query(`
      INSERT INTO opportunity_searches (user_id, org_id, name, naics_codes, keywords, agency, status)
      VALUES ($1, $2, 'IT Services & Cybersecurity', '541512,541519,518210', 'cybersecurity, cloud migration, IT modernization, FedRAMP', 'Department of Defense', 'active')
      RETURNING id
    `, [user.id, user.org_id]);
    searchId = searchRes.rows[0].id;

    // 5. Insert opportunities
    const opps = [
      ['APEX-2026-001', 'Enterprise Cloud Migration Services - DISA', 'Department of Defense', 'Defense Information Systems Agency', '541512', 'Small Business Set-Aside', '2026-04-07', '2026-05-01 17:00:00', 5000000, 15000000, 'DISA seeks qualified small businesses for enterprise cloud migration services including assessment, planning, migration execution, and post-migration support.', 'Fort Meade, MD', 'HC1028-26-R-0042', 92, 'Strong NAICS match (541512), cloud migration aligns perfectly with Apex capabilities, SB set-aside eligible', 'tracking'],
      ['APEX-2026-002', 'Zero Trust Architecture Implementation - US Air Force', 'Department of the Air Force', 'Space Systems Command', '541519', 'Total Small Business', '2026-04-08', '2026-04-28 14:00:00', 8000000, 25000000, 'USSF requires implementation of zero trust architecture across satellite command networks including identity management, access control, and continuous monitoring.', 'Los Angeles, CA', 'FA4400-26-R-8501', 88, 'Excellent fit: cybersecurity expertise, zero trust focus, advanced architecture match', 'new'],
      ['APEX-2026-003', 'Cybersecurity Operations Center Support - DHS', 'Department of Homeland Security', 'Cybersecurity and Infrastructure Security Agency', '541519', 'Service-Disabled Veteran-Owned Small Business', '2026-04-10', '2026-05-15 17:00:00', 12000000, 35000000, 'CISA requires 24/7 cybersecurity operations center support including threat hunting, incident response, vulnerability management, and security analytics.', 'Arlington, VA', 'HSFE80-26-R-0015', 85, 'Perfect SDVOSB alignment with Apex certification, strong SOC experience critical, 24/7 staffing required', 'tracking'],
      ['APEX-2026-004', 'FedRAMP Authorization Support Services - GSA', 'General Services Administration', 'Federal Acquisition Service', '541519', 'Best Value', '2026-04-09', '2026-05-10 14:00:00', 3000000, 10000000, 'GSA seeks experienced FedRAMP consulting firms to support government and contractor compliance with authorization, audit, and continuous monitoring requirements.', 'Washington, DC', 'GS-00F-26-0128', 90, 'FedRAMP Consulting core capability match, Apex has direct experience with authorization process', 'new'],
      ['APEX-2026-005', 'DevSecOps Platform Engineering - US Navy', 'Department of the Navy', 'Naval Supply Systems Command', '541512', 'Small Business Set-Aside', '2026-04-11', '2026-05-30 14:00:00', 8000000, 20000000, 'NAVSUP requires design and implementation of DevSecOps platform including CI/CD pipelines, container orchestration, and security automation.', 'Mechanicsburg, PA', 'N00104-26-R-0056', 82, 'DevSecOps is core Apex capability, cloud-native architecture, SB set-aside eligible', 'tracking'],
      ['APEX-2026-006', 'IT Infrastructure Modernization - VA', 'Department of Veterans Affairs', 'Office of Information and Technology', '541512', '8(a) Sole Source', '2026-04-12', '2026-04-15 12:00:00', 2000000, 8000000, 'VA OIT requires IT modernization including legacy system assessment, data migration, API development, and modern architecture implementation.', 'Washington, DC', 'VA118-26-R-0089', 75, 'IT modernization alignment, legacy system expertise, 8(a) certification advantage', 'saved'],
      ['APEX-2026-007', 'Data Center Consolidation - DOE', 'Department of Energy', 'Office of Information Management', '541512', 'Best Value', '2026-04-13', '2026-05-20 12:00:00', 15000000, 40000000, 'DOE requires consolidation of regional data centers into centralized cloud infrastructure with compliance, security, and redundancy requirements.', 'Golden, CO', 'DE-SOL-26-00291', 68, 'Cloud migration relevant, data center experience helpful, medium fit score', 'new'],
      ['APEX-2026-008', 'Network Security Assessment Services - HHS', 'Department of Health and Human Services', 'Information Security Division', '541519', 'Small Business Set-Aside', '2026-04-14', '2026-05-25 14:00:00', 1500000, 5000000, 'HHS seeks comprehensive network security assessment including vulnerability analysis, penetration testing, and compliance evaluation.', 'Rockville, MD', 'HHS-ISD-26-R-00156', 78, 'Cybersecurity assessment capability, HIPAA compliance expertise, good fit', 'new'],
    ];

    for (const opp of opps) {
      try {
        await client.query(`
          INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency, naics_code, set_aside, posted_date, response_deadline, value_min, value_max, description, place_of_performance, solicitation_number, fit_score, fit_reason, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (sam_notice_id) DO NOTHING
        `, [searchId, user.org_id, ...opp]);
        results.opportunities++;
      } catch (e) { console.error('Opp insert error:', e.message); }
    }

    // 6. Insert prime contractors
    const primes = [
      ['Booz Allen Hamilton', '1WAR4', 'BOOZHAMILUEI1', 'https://boozallen.com', '541512,541519,541611', 'ISO 27001, CMMI Level 3, FedRAMP High', 8900000000, 478, 'DOD, Intelligence, Civilian', 'Large', 91, 'Top-tier consulting, strong AI/ML and cybersecurity divisions seeking niche partners', 'outreach_sent', 'David Chen', 'd.chen@bah.com', 'Director of Teaming'],
      ['Leidos Holdings', '3BYT7', 'LEIDOSUEI0001', 'https://leidos.com', '541512,541519,541330', 'ISO 27001, CMMI Level 5, FedRAMP', 4500000000, 312, 'DOD, DHS, Intelligence Community', 'Large', 88, 'Major defense IT prime, actively seeks SB teaming partners in cloud and cyber', 'researched', 'Sarah Mitchell', 's.mitchell@leidos.com', 'VP Small Business Programs'],
      ['SAIC', '80209', 'SAICCOMPUEI01', 'https://saic.com', '541512,541330,541715', 'ISO 20000, CMMI Level 5, SOC 2 Type II', 7200000000, 289, 'DOD, Intelligence, Space', 'Large', 82, 'Cloud and digital transformation leader, building SB supplier base aggressively', 'not_contacted', 'Jennifer Park', 'j.park@saic.com', 'Small Business Liaison Officer'],
      ['ManTech International', '61788', 'MANTECHUEI001', 'https://mantech.com', '541512,541519,561210', 'ISO 27001, NIST 800-171, CMMI Level 3', 2800000000, 156, 'DOD, Intelligence, Federal Civilian', 'Large', 79, 'Mid-tier prime, strong cyber operations and IT services focus', 'not_contacted', 'Robert Taylor', 'r.taylor@mantech.com', 'VP Business Development'],
      ['Peraton', '5SZE0', 'PERATONUEI001', 'https://peraton.com', '541512,541519,517312', 'FedRAMP, ISO 27001, CMMI Level 5', 6800000000, 234, 'Intelligence, DOD, Civilian', 'Large', 85, 'Massive Intelligence Community footprint, aggressively expanding SB partnerships', 'researched', 'Amanda White', 'a.white@peraton.com', 'Teaming Coordinator'],
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

    // 7. Insert marketplace teaming opportunities
    const shared = [
      ['DISA Cloud Migration - Need SB IT Partner', 'Looking for small business with cloud migration experience for DISA enterprise cloud RFP. Prime handles program management; sub leads AWS/Azure migration and infrastructure design.', '541512', 'Small Business Set-Aside', 'Defense Information Systems Agency', '2026-04-25 17:00:00', 5000000, 15000000, 'Cloud Migration Lead, DevSecOps Engineer, Solutions Architect', 'AWS GovCloud or Azure Gov experience required. FedRAMP familiarity. Active Secret clearance minimum. Must have DoD experience.'],
      ['Army Cyber SOC - SDVOSB Teaming Partner', 'Seeking SDVOSB partner for Army Cyber Command SOC support contract. Need 24/7 SOC capabilities, threat hunting, and incident response with intelligence analysis.', '541519', 'SDVOSB', 'Department of the Army', '2026-05-10 14:00:00', 12000000, 35000000, 'SOC Analysts (Tier 1-3), Threat Hunters, Incident Responders, Intelligence Analysts', 'SDVOSB certification required. TS/SCI clearances. Prior DOD SOC experience preferred. 24/7 operations critical.'],
      ['GSA Data Analytics Platform - Analytics Sub', 'GSA FAS procurement analytics modernization. Need SB with data engineering and ML experience for federal procurement dataset analysis and reporting.', '518210', 'Best Value', 'General Services Administration', '2026-05-05 12:00:00', 3000000, 10000000, 'Data Engineers, ML Engineers, BI Developers, Data Scientists', 'Federal procurement data experience. Python/Spark/SQL expertise. FedRAMP helpful. Must support agile development.'],
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

    // 8. Create sequence events (touchpoints) for some leads - simulate outreach activity
    const leadsForSequence = await client.query(
      'SELECT id FROM leads WHERE list_id IN ($1, $2) LIMIT 10',
      [list1Id, list2Id]
    );

    const touchpoints = [
      'email1',
      'linkedin_connect',
      'call1',
      'email2',
      'call2',
      'email3',
    ];

    for (let i = 0; i < leadsForSequence.rows.length; i++) {
      const leadId = leadsForSequence.rows[i].id;
      const numTouches = Math.min(i + 1, 5); // Varies: 1-5 touches per lead

      for (let j = 0; j < numTouches; j++) {
        const touchpoint = touchpoints[j];
        const daysAgo = Math.max(1, (j + 1) * 2); // 2, 4, 6 days ago etc
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - daysAgo);

        try {
          await client.query(`
            INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, completed_at)
            VALUES ($1, $2, $3, 'done', $4)
            ON CONFLICT (lead_id, touchpoint) DO NOTHING
          `, [leadId, user.id, touchpoint, completedAt]);
          results.sequence_events++;
        } catch (e) { console.error('Sequence event error:', e.message); }
      }
    }

    // 9. Create notifications
    const notifications = [
      ['Cloud Migration deadline in 7 days', 'Enterprise Cloud Migration Services - DISA deadline approaching', '/opportunities/APEX-2026-001'],
      ['Follow up with Sarah Chen at DISA', 'Sarah Chen (Deputy CIO) has not responded to email 2. Recommended call follow-up.', '/leads'],
      ['New opportunity matches your profile: Zero Trust Architecture', 'Zero Trust Architecture Implementation matches 88% of Apex Defense Solutions capabilities', '/opportunities/APEX-2026-002'],
      ['Teaming request from Leidos', 'Leidos Holdings is interested in partnering with Apex Defense Solutions for DISA cloud contract', '/primes'],
      ['Weekly pipeline report ready', 'Your weekly sales pipeline summary is ready: 8 opportunities tracked, 2 new leads added', '/dashboard'],
    ];

    for (const [title, message, link] of notifications) {
      try {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, link, is_read)
          VALUES ($1, 'info', $2, $3, $4, false)
        `, [user.id, title, message, link]);
        results.notifications++;
      } catch (e) { console.error('Notification insert error:', e.message); }
    }

    // 10. Update or create sub profile for Apex Defense Solutions
    const profileRes = await client.query(
      'SELECT id FROM sub_profiles WHERE org_id = $1',
      [user.org_id]
    );

    if (profileRes.rows.length > 0) {
      // Update existing
      await client.query(`
        UPDATE sub_profiles SET
          company_name = 'Apex Defense Solutions LLC',
          website_url = 'https://apexdefensesolutions.com',
          naics_codes = '541512,541511,541519,518210,561210',
          cage_code = '8K7N2',
          uei = 'J7K9LM2N3P4Q',
          certifications = 'ISO 27001, CMMI Level 3, FedRAMP Authorized, NIST 800-171',
          is_public = true,
          tagline = 'Cloud migration, cybersecurity, and DevSecOps for federal contractors',
          capabilities = 'Enterprise Cloud Migration (AWS GovCloud, Azure Government), Cybersecurity Operations Center (SOC) Services, DevSecOps Platform Engineering, FedRAMP Authorization & Compliance, Zero Trust Architecture Implementation, Legacy System Modernization, Security Assessment & Consulting',
          target_agencies = 'Department of Defense, DHS, VA, DOE, GSA, Intelligence Community',
          set_aside_prefs = 'SDVOSB (Service-Disabled Veteran-Owned Small Business), 8(a) Certified, HUBZone Eligible'
        WHERE org_id = $1
      `, [user.org_id]);
    } else {
      // Create new
      await client.query(`
        INSERT INTO sub_profiles (user_id, org_id, company_name, website_url, naics_codes, cage_code, uei, certifications, is_public, tagline, capabilities, target_agencies, set_aside_prefs)
        VALUES ($1, $2, 'Apex Defense Solutions LLC', 'https://apexdefensesolutions.com', '541512,541511,541519,518210,561210', '8K7N2', 'J7K9LM2N3P4Q', 'ISO 27001, CMMI Level 3, FedRAMP Authorized, NIST 800-171', true, 'Cloud migration, cybersecurity, and DevSecOps for federal contractors', 'Enterprise Cloud Migration (AWS GovCloud, Azure Government), Cybersecurity Operations Center (SOC) Services, DevSecOps Platform Engineering, FedRAMP Authorization & Compliance, Zero Trust Architecture Implementation, Legacy System Modernization, Security Assessment & Consulting', 'Department of Defense, DHS, VA, DOE, GSA, Intelligence Community', 'SDVOSB (Service-Disabled Veteran-Owned Small Business), 8(a) Certified, HUBZone Eligible')
      `, [user.id, user.org_id]);
    }
    results.profile = true;

    res.json({ success: true, summary: results });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
