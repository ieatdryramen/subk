const router = require('express').Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const authFromQuery = async (req, res, next) => {
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const getLeads = async (listId, userId) => {
  const result = await pool.query(`
    SELECT l.*, p.research, p.email1, p.email2, p.email3, p.email4,
           p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
    FROM leads l
    LEFT JOIN playbooks p ON p.lead_id = l.id
    JOIN users u ON u.id = $2
    WHERE l.list_id = $1
      AND l.status = 'done'
      AND (
        l.user_id = $2 OR
        EXISTS (SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id AND u.org_id IS NOT NULL)
      )
    ORDER BY l.icp_score DESC NULLS LAST, l.created_at ASC
  `, [listId, userId]);
  return result.rows;
};

const escHtml = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Proper RFC 4180 CSV escaping: wrap in quotes, escape internal quotes by doubling them
// Newlines inside fields are allowed and must stay inside the quoted field
const escCsv = (val) => {
  const str = String(val == null ? '' : val);
  // Always wrap in double quotes; escape internal double quotes by doubling
  return '"' + str.replace(/"/g, '""') + '"';
};

// HTML export
router.get('/list/:listId/html', authFromQuery, async (req, res) => {
  try {
    const leads = await getLeads(req.params.listId, req.userId);
    if (!leads.length) return res.status(400).json({ error: 'No completed playbooks to export' });
    const listResult = await pool.query('SELECT name FROM lead_lists WHERE id=$1', [req.params.listId]);
    const listName = listResult.rows[0]?.name || 'Export';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escHtml(listName)} — ProspectForge</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.7; color: #1a1a1a; background: white; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; text-align: center; padding: 4rem; }
  .cover h1 { font-size: 36px; font-weight: 700; margin-bottom: 12px; }
  .cover p { font-size: 15px; color: #666; margin-bottom: 6px; }
  .lead { page-break-before: always; padding: 2.5rem 3rem; max-width: 820px; margin: 0 auto; }
  .lead-header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .lead-name { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .lead-meta { font-size: 13px; color: #555; }
  .score { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 10px; vertical-align: middle; }
  .score-high { background: #dcfce7; color: #166534; }
  .score-mid { background: #fef9c3; color: #854d0e; }
  .score-low { background: #fee2e2; color: #991b1b; }
  .section { margin-bottom: 1.75rem; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .section-content { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; line-height: 1.75; }
  .email-block { border-left: 3px solid #6c63ff; padding: 12px 16px; margin-bottom: 14px; background: #fafafa; }
  .email-day { font-size: 10px; font-weight: 700; color: #6c63ff; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; padding: 12px 24px; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: sans-serif; }
  @media print { .print-btn { display: none; } .lead { page-break-before: always; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
<div class="cover">
  <h1>${escHtml(listName)}</h1>
  <p>ProspectForge Sales Playbooks</p>
  <p>${leads.length} playbook${leads.length !== 1 ? 's' : ''}</p>
  <p>Generated ${new Date().toLocaleDateString()}</p>
</div>
${leads.map(lead => {
  const score = lead.icp_score;
  const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
  return `<div class="lead">
  <div class="lead-header">
    <div class="lead-name">${escHtml(lead.full_name || 'Unknown')}${score != null ? `<span class="score ${scoreClass}">${score}/100</span>` : ''}</div>
    <div class="lead-meta">${[lead.title, lead.company, lead.email].filter(Boolean).map(escHtml).join(' · ')}</div>
    ${lead.icp_reason ? `<div style="font-size:12px;color:#777;margin-top:4px;font-style:italic">${escHtml(lead.icp_reason)}</div>` : ''}
  </div>
  ${lead.research ? `<div class="section"><div class="section-title">Research Brief</div><div class="section-content">${escHtml(lead.research)}</div></div>` : ''}
  <div class="section">
    <div class="section-title">Email Sequence</div>
    ${lead.email1 ? `<div class="email-block"><div class="email-day">Day 1</div><div class="section-content">${escHtml(lead.email1)}</div></div>` : ''}
    ${lead.email2 ? `<div class="email-block"><div class="email-day">Day 3</div><div class="section-content">${escHtml(lead.email2)}</div></div>` : ''}
    ${lead.email3 ? `<div class="email-block"><div class="email-day">Day 7</div><div class="section-content">${escHtml(lead.email3)}</div></div>` : ''}
    ${lead.email4 ? `<div class="email-block"><div class="email-day">Day 14</div><div class="section-content">${escHtml(lead.email4)}</div></div>` : ''}
  </div>
  ${lead.call_opener ? `<div class="section"><div class="section-title">Call Opener</div><div class="section-content">${escHtml(lead.call_opener)}</div></div>` : ''}
  ${lead.linkedin ? `<div class="section"><div class="section-title">LinkedIn</div><div class="section-content">${escHtml(lead.linkedin)}</div></div>` : ''}
  ${lead.objection_handling ? `<div class="section"><div class="section-title">Objection Handling</div><div class="section-content">${escHtml(lead.objection_handling)}</div></div>` : ''}
  ${lead.callbacks ? `<div class="section"><div class="section-title">Callbacks & Talking Points</div><div class="section-content">${escHtml(lead.callbacks)}</div></div>` : ''}
</div>`;
}).join('')}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${listName.replace(/[^a-z0-9]/gi, '_')}_playbooks.html"`);
    res.send(html);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CSV export — RFC 4180 compliant with \r\n row terminators
router.get('/list/:listId/csv', authFromQuery, async (req, res) => {
  try {
    const leads = await getLeads(req.params.listId, req.userId);
    if (!leads.length) return res.status(400).json({ error: 'No completed playbooks to export' });
    const listResult = await pool.query('SELECT name FROM lead_lists WHERE id=$1', [req.params.listId]);
    const listName = listResult.rows[0]?.name || 'Export';

    const headers = [
      'Name', 'Company', 'Title', 'Email', 'LinkedIn URL',
      'ICP Score', 'ICP Reason',
      'Research',
      'Email 1 (Day 1)', 'Email 2 (Day 3)', 'Email 3 (Day 7)', 'Email 4 (Day 14)',
      'LinkedIn Messages', 'Call Opener', 'Objection Handling', 'Callbacks'
    ];

    const rows = leads.map(l => [
      l.full_name, l.company, l.title, l.email, l.linkedin,
      l.icp_score, l.icp_reason,
      l.research,
      l.email1, l.email2, l.email3, l.email4,
      l.linkedin, l.call_opener, l.objection_handling, l.callbacks
    ].map(escCsv).join(','));

    // Use \r\n as row separator (RFC 4180 standard) — this prevents
    // newlines inside quoted fields from being mistaken as row breaks
    const CRLF = '\r\n';
    const csv = [headers.map(escCsv).join(','), ...rows].join(CRLF) + CRLF;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${listName.replace(/[^a-z0-9]/gi, '_')}_playbooks.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Single lead HTML export
router.get('/lead/:leadId/html', authFromQuery, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, p.research, p.email1, p.email2, p.email3, p.email4,
             p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
      FROM leads l
      LEFT JOIN playbooks p ON p.lead_id = l.id
      WHERE l.id = $1 AND l.status = 'done'
    `, [req.params.leadId]);

    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found or playbook not generated' });
    const lead = result.rows[0];
    const score = lead.icp_score;
    const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escHtml(lead.full_name || 'Lead')} — ProspectForge</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.7; color: #1a1a1a; background: white; padding: 2.5rem 3rem; max-width: 820px; margin: 0 auto; }
  .lead-header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .lead-name { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .lead-meta { font-size: 13px; color: #555; }
  .score { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 10px; vertical-align: middle; }
  .score-high { background: #dcfce7; color: #166534; }
  .score-mid { background: #fef9c3; color: #854d0e; }
  .score-low { background: #fee2e2; color: #991b1b; }
  .section { margin-bottom: 1.75rem; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .section-content { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; line-height: 1.75; }
  .email-block { border-left: 3px solid #6c63ff; padding: 12px 16px; margin-bottom: 14px; background: #fafafa; }
  .email-day { font-size: 10px; font-weight: 700; color: #6c63ff; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; padding: 12px 24px; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: sans-serif; }
  @media print { .print-btn { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
<div class="lead-header">
  <div class="lead-name">${escHtml(lead.full_name || 'Unknown')}${score != null ? `<span class="score ${scoreClass}">${score}/100</span>` : ''}</div>
  <div class="lead-meta">${[lead.title, lead.company, lead.email].filter(Boolean).map(escHtml).join(' · ')}</div>
  ${lead.icp_reason ? `<div style="font-size:12px;color:#777;margin-top:4px;font-style:italic">${escHtml(lead.icp_reason)}</div>` : ''}
</div>
${lead.research ? `<div class="section"><div class="section-title">Research Brief</div><div class="section-content">${escHtml(lead.research)}</div></div>` : ''}
<div class="section">
  <div class="section-title">Email Sequence</div>
  ${lead.email1 ? `<div class="email-block"><div class="email-day">Email 1</div><div class="section-content">${escHtml(lead.email1)}</div></div>` : ''}
  ${lead.email2 ? `<div class="email-block"><div class="email-day">Email 2</div><div class="section-content">${escHtml(lead.email2)}</div></div>` : ''}
  ${lead.email3 ? `<div class="email-block"><div class="email-day">Email 3</div><div class="section-content">${escHtml(lead.email3)}</div></div>` : ''}
  ${lead.email4 ? `<div class="email-block"><div class="email-day">Email 4</div><div class="section-content">${escHtml(lead.email4)}</div></div>` : ''}
</div>
${lead.linkedin ? `<div class="section"><div class="section-title">LinkedIn</div><div class="section-content">${escHtml(lead.linkedin)}</div></div>` : ''}
${lead.call_opener ? `<div class="section"><div class="section-title">Call Opener</div><div class="section-content">${escHtml(lead.call_opener)}</div></div>` : ''}
${lead.objection_handling ? `<div class="section"><div class="section-title">Objection Handling</div><div class="section-content">${escHtml(lead.objection_handling)}</div></div>` : ''}
${lead.callbacks ? `<div class="section"><div class="section-title">Callbacks</div><div class="section-content">${escHtml(lead.callbacks)}</div></div>` : ''}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${(lead.full_name || 'lead').replace(/[^a-z0-9]/gi, '_')}_playbook.html"`);
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single lead CSV export
router.get('/lead/:leadId/csv', authFromQuery, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, p.research, p.email1, p.email2, p.email3, p.email4,
             p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
      FROM leads l
      LEFT JOIN playbooks p ON p.lead_id = l.id
      WHERE l.id = $1 AND l.status = 'done'
    `, [req.params.leadId]);

    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found or playbook not generated' });
    const l = result.rows[0];

    const headers = ['Name','Company','Title','Email','LinkedIn URL','ICP Score','ICP Reason','Research','Email 1','Email 2','Email 3','Email 4','LinkedIn Messages','Call Opener','Objection Handling','Callbacks'];
    const row = [l.full_name, l.company, l.title, l.email, l.linkedin, l.icp_score, l.icp_reason, l.research, l.email1, l.email2, l.email3, l.email4, l.linkedin, l.call_opener, l.objection_handling, l.callbacks].map(escCsv);

    const CRLF = '\r\n';
    const csv = [headers.map(escCsv).join(','), row.join(',')].join(CRLF) + CRLF;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${(l.full_name || 'lead').replace(/[^a-z0-9]/gi, '_')}_playbook.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep old route for backward compat
router.get('/list/:listId', authFromQuery, async (req, res) => {
  res.redirect(`/api/export/list/${req.params.listId}/html?token=${req.query.token}`);
});

module.exports = router;

