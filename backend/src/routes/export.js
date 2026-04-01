const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

router.get('/list/:listId', auth, async (req, res) => {
  try {
    const leadsResult = await pool.query(
      `SELECT l.*, p.research, p.email1, p.email2, p.email3, p.email4, p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
       FROM leads l LEFT JOIN playbooks p ON p.lead_id=l.id
       WHERE l.list_id=$1 AND l.user_id=$2 AND l.status='done' ORDER BY l.icp_score DESC NULLS LAST, l.created_at ASC`,
      [req.params.listId, req.userId]
    );
    const leads = leadsResult.rows;
    if (!leads.length) return res.status(400).json({ error: 'No completed playbooks to export' });

    const listResult = await pool.query('SELECT name FROM lead_lists WHERE id=$1', [req.params.listId]);
    const listName = listResult.rows[0]?.name || 'Export';

    // Generate HTML that can be printed to PDF
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${listName} — ProspectForge Playbooks</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; background: white; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; text-align: center; padding: 4rem; }
  .cover h1 { font-size: 36px; font-weight: 700; margin-bottom: 12px; }
  .cover p { font-size: 16px; color: #666; margin-bottom: 8px; }
  .lead { page-break-before: always; padding: 2.5rem 3rem; max-width: 800px; margin: 0 auto; }
  .lead-header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .lead-name { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .lead-meta { font-size: 14px; color: #555; }
  .score { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-left: 12px; }
  .score-high { background: #dcfce7; color: #166534; }
  .score-mid { background: #fef9c3; color: #854d0e; }
  .score-low { background: #fee2e2; color: #991b1b; }
  .section { margin-bottom: 1.5rem; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .section-content { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; line-height: 1.7; }
  .email-block { background: #f9f9f9; border-left: 3px solid #6c63ff; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 4px 4px 0; }
  .email-day { font-size: 11px; font-weight: 700; color: #6c63ff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  @media print {
    .lead { page-break-before: always; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="cover">
  <h1>${listName}</h1>
  <p>ProspectForge Sales Playbooks</p>
  <p>${leads.length} playbook${leads.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleDateString()}</p>
</div>
${leads.map(lead => {
  const score = lead.icp_score;
  const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
  return `
<div class="lead">
  <div class="lead-header">
    <div class="lead-name">
      ${lead.full_name || 'Unknown'}
      ${score ? `<span class="score ${scoreClass}">ICP Score: ${score}</span>` : ''}
    </div>
    <div class="lead-meta">${[lead.title, lead.company, lead.email].filter(Boolean).join(' · ')}</div>
    ${lead.icp_reason ? `<div style="font-size:12px;color:#666;margin-top:4px;font-style:italic">${lead.icp_reason}</div>` : ''}
  </div>

  ${lead.research ? `<div class="section"><div class="section-title">Research Brief</div><div class="section-content">${lead.research}</div></div>` : ''}

  <div class="section">
    <div class="section-title">Email Sequence</div>
    ${lead.email1 ? `<div class="email-block"><div class="email-day">Day 1</div><div class="section-content">${lead.email1}</div></div>` : ''}
    ${lead.email2 ? `<div class="email-block"><div class="email-day">Day 3</div><div class="section-content">${lead.email2}</div></div>` : ''}
    ${lead.email3 ? `<div class="email-block"><div class="email-day">Day 7</div><div class="section-content">${lead.email3}</div></div>` : ''}
    ${lead.email4 ? `<div class="email-block"><div class="email-day">Day 14</div><div class="section-content">${lead.email4}</div></div>` : ''}
  </div>

  ${lead.call_opener ? `<div class="section"><div class="section-title">Call Opener</div><div class="section-content">${lead.call_opener}</div></div>` : ''}
  ${lead.linkedin ? `<div class="section"><div class="section-title">LinkedIn</div><div class="section-content">${lead.linkedin}</div></div>` : ''}
  ${lead.objection_handling ? `<div class="section"><div class="section-title">Objection Handling</div><div class="section-content">${lead.objection_handling}</div></div>` : ''}
  ${lead.callbacks ? `<div class="section"><div class="section-title">Callbacks & Talking Points</div><div class="section-content">${lead.callbacks}</div></div>` : ''}
</div>`;
}).join('')}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${listName.replace(/[^a-z0-9]/gi, '_')}_playbooks.html"`);
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
