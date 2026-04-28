// Email delivery wrapper using Gmail SMTP via nodemailer.
// Requires env vars:
//   GMAIL_USER          - your Gmail address (e.g. accela.official@gmail.com)
//   GMAIL_APP_PASSWORD  - 16-char Google App Password (NOT your normal password)
// Optional:
//   EMAIL_FROM          - display "From" address, defaults to "Accela <GMAIL_USER>"
//
// If credentials are missing, sending becomes a no-op so the app keeps running
// and the admin can handle resets/verifications manually.

const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cachedTransporter;
}

function getFromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const user = process.env.GMAIL_USER;
  return user ? `Accela <${user}>` : 'Accela';
}

async function sendViaGmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'NO_PROVIDER' };

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
    console.log(`📧 Email sent to ${to} (id: ${info.messageId || 'unknown'})`);
    return { sent: true, providerId: info.messageId };
  } catch (err) {
    console.error('📧 Gmail SMTP error:', err.message);
    return { sent: false, reason: 'TRANSPORT_ERROR', error: err.message };
  }
}

function passwordResetTemplate({ username, resetUrl, validityMinutes = 60 }) {
  const subject = 'Reset your Accela password';
  const text =
`Hi ${username},

We received a request to reset the password for your Accela account.

Click the link below to set a new password (valid for ${validityMinutes} minutes):
${resetUrl}

If you didn't request this, you can safely ignore this email — your password will stay the same.

— Accela`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0a0a; padding:32px 16px; color:#fff;">
  <div style="max-width:520px; margin:0 auto; background:#16213e; border-radius:16px; padding:32px 28px;">
    <h1 style="margin:0 0 8px; color:#00ffcc; font-size:22px;">Reset your password</h1>
    <p style="color:#cfd8e3; line-height:1.6; font-size:15px;">
      Hi <strong>${username}</strong>, we got a request to reset the password for your Accela account.
    </p>
    <p style="text-align:center; margin:28px 0;">
      <a href="${resetUrl}"
         style="display:inline-block; padding:14px 28px; background:linear-gradient(135deg,#00ffcc,#00aaff);
                color:#000; text-decoration:none; border-radius:10px; font-weight:700; font-size:15px;">
        Set New Password
      </a>
    </p>
    <p style="color:#9aa6b2; font-size:12px; line-height:1.6;">
      This link is valid for ${validityMinutes} minutes. If you didn't request this, you can safely
      ignore this email — your password will stay the same.
    </p>
    <p style="color:#5e6772; font-size:11px; word-break:break-all; margin-top:20px;">
      Or paste this URL: ${resetUrl}
    </p>
  </div>
  <p style="text-align:center; color:#5e6772; font-size:11px; margin-top:18px;">— Accela</p>
</div>`;

  return { subject, html, text };
}

async function sendPasswordResetEmail({ to, username, resetUrl, validityMinutes }) {
  const tpl = passwordResetTemplate({ username, resetUrl, validityMinutes });
  return sendViaGmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

function verificationTemplate({ username, code, validityHours = 24 }) {
  const subject = `Your Accela verification code: ${code}`;
  const text =
`Hi ${username},

Welcome to Accela! Please confirm your email address by entering this 6-digit code:

      ${code}

This code is valid for ${validityHours} hours. If you didn't sign up for Accela, you can safely ignore this email.

— Accela`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0a0a; padding:32px 16px; color:#fff;">
  <div style="max-width:520px; margin:0 auto; background:#16213e; border-radius:16px; padding:32px 28px;">
    <h1 style="margin:0 0 8px; color:#00ffcc; font-size:22px;">Welcome to Accela 👋</h1>
    <p style="color:#cfd8e3; line-height:1.6; font-size:15px;">
      Hi <strong>${username}</strong>, please confirm your email address with the 6-digit code below.
    </p>
    <div style="text-align:center; margin:28px 0;">
      <div style="display:inline-block; padding:18px 32px; background:linear-gradient(135deg,rgba(0,255,204,0.12),rgba(0,170,255,0.12));
                  border:1px solid rgba(0,255,204,0.4); border-radius:12px; font-size:32px; font-weight:700;
                  color:#00ffcc; letter-spacing:8px; font-family:monospace;">
        ${code}
      </div>
    </div>
    <p style="color:#9aa6b2; font-size:12px; line-height:1.6; text-align:center;">
      This code expires in ${validityHours} hours. If you didn't sign up, you can safely ignore this email.
    </p>
  </div>
  <p style="text-align:center; color:#5e6772; font-size:11px; margin-top:18px;">— Accela</p>
</div>`;

  return { subject, html, text };
}

async function sendVerificationEmail({ to, username, code, validityHours }) {
  const tpl = verificationTemplate({ username, code, validityHours });
  return sendViaGmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
