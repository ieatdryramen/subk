const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// POST /api/seed/demo - Load GovCon demo data (admin only)
router.post('/demo', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Verify admin
    const userR = await client.query('SELECT id, org_id, role FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const results = { opportunities: 0, primes: 0, marketplace: 0, profile: false };

    // 1. Create opportunity search
    let searchId;
    const searchRes = await client.query(`
      INSERT INTO opportunity_searches (user_id, org_id, name, naics_codes, keywords, agency, status)
      VALUES ($1, $2, 'IT Services & Cybersecurity', '541512,541519,518210', 'cybersecurity, cloud migration, IT modernization', 'Department of Defense', 'active')
      RETURNING id
    `, [user.id, user.org_id]);
    searchId = searchRes.rows[0].id;

    // 2. Insert opportunities
    const opps = [
      ['SAM-2026-001', 'Enterprise Cloud Migration Services', 'Department of Defense', 'Defense Information Systems Agency', '541512', 'Small Business Set-Aside', '2026-03-15', '2026-05-01 17:00:00', 5000000, 15000000, 'DISA seeks qualified small businesses for enterprise cloud migration services including assessment, planning, migration execution, and post-migration support.', 'Fort Meade, MD', 'HC1028-26-R-0042', 87, 'Strong NAICS match (541512), cloud migration aligns with capabilities, SB set-aside eligible', 'tracking'],
      ['SAM-2026-002', 'Zero Trust Architecture Implementation', 'Department of Homeland Security', 'CISA', '541519', 'Total Small Business', '2026-03-20', '2026-04-28 14:00:00', 8000000, 25000000, 'CISA requires implementation of zero trust architecture across federal civilian agencies including network segmentation, identity management, and continuous monitoring.', 'Washington, DC', 'HSFE80-26-R-0015', 92, 'Excellent fit: cybersecurity NAICS, zero trust expertise matches capabilities', 'tracking'],
      ['SAM-2026-003', 'IT Modernization Support Services', 'Department of Veterans Affairs', 'Office of Information and Technology', '541512', '8(a) Sole Source', '2026-03-10', '2026-04-15 12:00:00', 2000000, 8000000, 'VA OIT requires IT modernization support including legacy system assessment, data migration, API development, and DevSecOps implementation.', 'Multiple Locations', 'VA118-26-R-0089', 78, 'Good NAICS match, IT modernization relevant, 8(a) set-aside may limit eligibility', 'saved'],
      ['SAM-2026-004', 'Cybersecurity Operations Center Support', 'Department of the Army', 'Army Cyber Command', '541519', 'Service-Disabled Veteran-Owned Small Business', '2026-04-01', '2026-05-15 17:00:00', 12000000, 35000000, 'ARCYBER requires 24/7 cybersecurity operations center support including threat hunting, incident response, and vulnerability management.', 'Fort Gordon, GA', 'W56KGZ-26-R-0033', 85, 'Strong cybersecurity alignment, SDVOSB teaming advantageous', 'tracking'],
      ['SAM-2026-005', 'Federal Data Analytics Platform', 'General Services Administration', 'Federal Acquisition Service', '518210', 'Best Value', '2026-03-25', '2026-05-10 14:00:00', 3000000, 10000000, 'GSA FAS seeks a modern data analytics platform for procurement analytics, spend analysis, and acquisition intelligence.', 'Washington, DC', 'GS-00F-26-0128', 73, 'Data analytics matches NAICS, ML capabilities align', 'new'],
      ['SAM-2026-006', 'Secure Communications Infrastructure', 'Department of State', 'Bureau of Diplomatic Security', '541519', 'Total Small Business', '2026-04-05', '2026-06-01 12:00:00', 20000000, 50000000, 'State Department requires secure communications infrastructure modernization for embassies and consulates worldwide.', 'Washington, DC & OCONUS', 'SAQMMA-26-R-0007', 68, 'Cybersecurity relevant but OCONUS scope and SCIF requirements need teaming', 'new'],
      ['SAM-2026-007', 'AI/ML Platform for Intelligence Community', 'ODNI', 'Chief Information Officer', '541512', 'Full and Open', '2026-03-28', '2026-05-20 17:00:00', 50000000, 150000000, 'ODNI seeks AI/ML platform development for intelligence analysis automation including NLP, computer vision, and predictive analytics.', 'McLean, VA', 'HHM402-26-R-0011', 62, 'AI/ML aligns with tech stack but TS/SCI and scale suggest prime-sub teaming', 'saved'],
      ['SAM-2026-008', 'Cloud-Based ERP Modernization', 'Department of the Navy', 'Naval Supply Systems Command', '541512', 'Small Business Set-Aside', '2026-04-02', '2026-05-30 14:00:00', 8000000, 20000000, 'NAVSUP requires modernization of legacy ERP systems to cloud-based solutions including SAP S/4HANA migration.', 'Mechanicsburg, PA', 'N00104-26-R-0056', 81, 'Cloud migration expertise matches well, SB set-aside eligible', 'tracking'],
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

    // 3. Insert prime contractors
    const primes = [
      ['Leidos Holdings', '3BYT7', 'LEIDOSUEI0001', 'https://leidos.com', '541512,541519,541330', 'ISO 27001, CMMI Level 5, FedRAMP', 4500000000, 312, 'DOD, DHS, Intelligence Community', 'Large', 88, 'Major defense IT prime, actively seeks SB teaming partners', 'researched', 'Sarah Mitchell', 's.mitchell@leidos.com', 'VP Small Business Programs'],
      ['Booz Allen Hamilton', '1WAR4', 'BOOZHAMILUEI1', 'https://boozallen.com', '541512,541519,541611', 'ISO 27001, CMMI Level 3, FedRAMP High', 8900000000, 478, 'DOD, Intelligence, Civilian', 'Large', 91, 'Top-tier consulting, strong AI/ML division seeking niche partners', 'outreach_sent', 'David Chen', 'd.chen@bah.com', 'Director of Teaming'],
      ['SAIC', '80209', 'SAICCOMPUEI01', 'https://saic.com', '541512,541330,541715', 'ISO 20000, CMMI Level 5, SOC 2 Type II', 7200000000, 289, 'DOD, Intelligence, Space', 'Large', 82, 'Cloud and digital transformation, building SB supplier base', 'not_contacted', 'Jennifer Park', 'j.park@saic.com', 'Small Business Liaison Officer'],
      ['ManTech International', '61788', 'MANTECHUEI001', 'https://mantech.com', '541512,541519,561210', 'ISO 27001, NIST 800-171, CMMI Level 3', 2800000000, 156, 'DOD, Intelligence, Federal Civilian', 'Large', 79, 'Mid-tier prime, strong cyber and IT operations', 'not_contacted', 'Robert Taylor', 'r.taylor@mantech.com', 'VP Business Development'],
      ['Peraton', '5SZE0', 'PERATONUEI001', 'https://peraton.com', '541512,541519,517312', 'FedRAMP, ISO 27001, CMMI Level 5', 6800000000, 234, 'Intelligence, DOD, Civilian', 'Large', 85, 'Massive IC footprint, aggressively seeking SB teaming', 'researched', 'Amanda White', 'a.white@peraton.com', 'Teaming Coordinator'],
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

    // 4. Insert marketplace teaming opportunities
    const shared = [
      ['DISA Cloud Migration - Need SB IT Partner', 'Looking for small business with cloud migration experience for DISA enterprise cloud RFP. Prime handles program management; sub leads AWS/Azure migration.', '541512', 'Small Business Set-Aside', 'Defense Information Systems Agency', '2026-04-25 17:00:00', 5000000, 15000000, 'Cloud Migration Lead, DevSecOps Engineer, Solutions Architect', 'AWS GovCloud or Azure Gov experience required. FedRAMP familiarity. Active Secret clearance minimum.'],
      ['Army Cyber SOC - SDVOSB Teaming Partner', 'Seeking SDVOSB partner for Army Cyber Command SOC support. Need 24/7 SOC capabilities, threat hunting, and incident response.', '541519', 'SDVOSB', 'Department of the Army', '2026-05-10 14:00:00', 12000000, 35000000, 'SOC Analysts (Tier 1-3), Threat Hunters, Incident Responders', 'SDVOSB certification required. TS/SCI clearances. Prior DOD SOC experience preferred.'],
      ['GSA Data Analytics Platform - Analytics Sub', 'GSA FAS procurement analytics modernization. Need sub with data engineering and ML experience.', '518210', 'Best Value', 'General Services Administration', '2026-05-05 12:00:00', 3000000, 10000000, 'Data Engineers, ML Engineers, BI Developers', 'Federal procurement data experience. Python/Spark/SQL. FedRAMP helpful.'],
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

    // 5. Update sub profile
    try {
      await client.query(`
        UPDATE sub_profiles SET
          is_public = true,
          tagline = 'Modern GovCon ERP & AI Solutions for Federal Contractors',
          capabilities = 'Cloud-native ERP systems, AI/ML-powered analytics, Federal procurement automation, Cybersecurity compliance tools, Legacy system modernization, API integration & DevSecOps',
          target_agencies = 'Department of Defense, DHS, GSA, VA, Intelligence Community',
          set_aside_prefs = 'Small Business, 8(a), HUBZone'
        WHERE company_name = 'Apex Defense Solutions LLC'
      `);
      results.profile = true;
    } catch (e) { console.error('Profile update error:', e.message); }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
