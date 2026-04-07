const nodemailer = require('nodemailer');

// Create transporter — uses SMTP_* env vars if set, otherwise logs to console
let transporter;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Dev/preview mode: log emails to console
  transporter = {
    sendMail: async (opts) => {
      console.log('[EMAIL-PREVIEW]', JSON.stringify({ to: opts.to, subject: opts.subject }, null, 2));
      return { messageId: 'preview-' + Date.now() };
    }
  };
}

const FROM = process.env.SMTP_FROM || 'SubK <noreply@subk.app>';

async function sendTeamingRequestNotification({ toEmail, toName, fromName, fromCompany, message }) {
  try {
    await transporter.sendMail({
      from: FROM,
      to: toEmail,
      subject: `New teaming request from ${fromCompany || fromName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
          <div style="padding: 24px 0; border-bottom: 2px solid #6366f1;">
            <h1 style="font-size: 20px; font-weight: 700; color: #6366f1; margin: 0;">SubK</h1>
            <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin: 2px 0 0;">GovCon Teaming</p>
          </div>
          <div style="padding: 24px 0;">
            <p>Hi ${toName || 'there'},</p>
            <p><strong>${fromCompany || fromName}</strong> has sent you a teaming request on SubK.</p>
            ${message ? `<div style="background: #f5f5ff; border-left: 3px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><em>"${message}"</em></div>` : ''}
            <p>Log in to your SubK account to review and respond:</p>
            <a href="${process.env.FRONTEND_URL || 'https://subk-production.up.railway.app'}/teaming"
               style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 8px 0;">
              View Teaming Inbox
            </a>
          </div>
          <div style="padding: 16px 0; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            You're receiving this because you have an account on SubK.
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL-ERROR] teaming request:', err.message);
    return false;
  }
}

async function sendInterestNotification({ toEmail, toName, subName, subCompany, opportunityTitle, message }) {
  try {
    await transporter.sendMail({
      from: FROM,
      to: toEmail,
      subject: `${subCompany || subName} is interested in: ${opportunityTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
          <div style="padding: 24px 0; border-bottom: 2px solid #6366f1;">
            <h1 style="font-size: 20px; font-weight: 700; color: #6366f1; margin: 0;">SubK</h1>
            <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin: 2px 0 0;">GovCon Teaming</p>
          </div>
          <div style="padding: 24px 0;">
            <p>Hi ${toName || 'there'},</p>
            <p>A subcontractor has expressed interest in your posted opportunity:</p>
            <div style="background: #f5f5ff; padding: 12px 16px; border-radius: 6px; margin: 12px 0;">
              <strong>${opportunityTitle}</strong>
            </div>
            <p><strong>${subCompany || subName}</strong> wants to team up.</p>
            ${message ? `<div style="background: #f9f9f9; border-left: 3px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><em>"${message}"</em></div>` : ''}
            <a href="${process.env.FRONTEND_URL || 'https://subk-production.up.railway.app'}/marketplace"
               style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 8px 0;">
              View Interested Subs
            </a>
          </div>
          <div style="padding: 16px 0; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            You're receiving this because you posted this opportunity on SubK.
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL-ERROR] interest notification:', err.message);
    return false;
  }
}

module.exports = { sendTeamingRequestNotification, sendInterestNotification };
