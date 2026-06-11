const crypto = require('crypto');
const nodemailer = require('nodemailer');

const TOKEN_TTL_HOURS = {
  verify_email: 48,
  reset_password: 2
};

function getSiteUrl() {
  return (process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  if (!isSmtpConfigured()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function baseEmailHtml(title, bodyHtml, cta = null) {
  const ctaHtml = cta ? `
    <p style="margin:24px 0;">
      <a href="${escapeHtml(cta.url)}" style="background:#0636a8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;">${escapeHtml(cta.label)}</a>
    </p>
  ` : '';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;background:#f6f8ff;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
        <p style="margin:0 0 12px;color:#0636a8;font-weight:800;">1rumah.biz.id</p>
        <h1 style="font-size:22px;margin:0 0 16px;color:#111827;">${escapeHtml(title)}</h1>
        ${bodyHtml}
        ${ctaHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="font-size:12px;color:#6b7280;margin:0;">Email otomatis dari 1rumah.biz.id. Abaikan jika Anda merasa tidak melakukan aktivitas terkait.</p>
      </div>
    </div>
  `;
}

async function getEmailSetting(prisma, key, fallback = null) {
  const row = await prisma.emailSetting.findUnique({ where: { key } });
  return row && row.value !== null && row.value !== undefined ? row.value : fallback;
}

async function setEmailSetting(prisma, key, value) {
  return prisma.emailSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

async function getAdminRecipients(prisma) {
  const configured = await getEmailSetting(prisma, 'admin_notification_email', process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SUPER_ADMIN_EMAIL || '');
  return String(configured || '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
}

async function isTemplateEnabled(prisma, key, fallback = true) {
  const value = await getEmailSetting(prisma, key, fallback ? 'true' : 'false');
  return value !== 'false';
}

async function sendEmail(prisma, { to, subject, html, text, template, userId = null, metadata = {}, eventKey = null }) {
  if (!to) return null;

  if (eventKey) {
    const existing = await prisma.emailLog.findUnique({ where: { eventKey } });
    if (existing) return existing;
  }

  const log = await prisma.emailLog.create({
    data: {
      userId,
      recipient: to,
      subject,
      template,
      status: 'pending',
      eventKey,
      metadata: JSON.stringify(metadata || {})
    }
  });

  const transporter = createTransporter();
  if (!transporter) {
    return prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'skipped',
        errorMessage: 'SMTP belum dikonfigurasi.'
      }
    });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });

    return prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'sent',
        sentAt: new Date()
      }
    });
  } catch (error) {
    return prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        errorMessage: error.message
      }
    });
  }
}

async function createEmailToken(prisma, userId, type) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttlHours = TOKEN_TTL_HOURS[type] || 2;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.emailToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  return token;
}

async function sendVerificationEmail(prisma, user) {
  if (!user.email || user.emailVerifiedAt || !await isTemplateEnabled(prisma, 'email_verify_enabled')) {
    return null;
  }

  const token = await createEmailToken(prisma, user.id, 'verify_email');
  const url = `${getSiteUrl()}/auth/verify-email?token=${token}`;
  const html = baseEmailHtml(
    'Verifikasi Email Anda',
    `<p>Halo ${escapeHtml(user.name)}, klik tombol di bawah untuk memverifikasi email akun Anda.</p>`,
    { label: 'Verifikasi Email', url }
  );

  return sendEmail(prisma, {
    to: user.email,
    subject: 'Verifikasi email akun 1rumah.biz.id',
    html,
    text: `Verifikasi email Anda: ${url}`,
    template: 'verify_email',
    userId: user.id,
    eventKey: `verify:${user.id}:${Date.now()}`,
    metadata: { userId: user.id }
  });
}

async function sendPasswordResetEmail(prisma, user) {
  if (!user.email || !await isTemplateEnabled(prisma, 'email_reset_enabled')) {
    return null;
  }

  const token = await createEmailToken(prisma, user.id, 'reset_password');
  const url = `${getSiteUrl()}/auth/reset-password?token=${token}`;
  const html = baseEmailHtml(
    'Reset Kata Sandi',
    `<p>Halo ${escapeHtml(user.name)}, kami menerima permintaan reset kata sandi untuk akun Anda.</p><p>Link ini berlaku 2 jam.</p>`,
    { label: 'Reset Kata Sandi', url }
  );

  return sendEmail(prisma, {
    to: user.email,
    subject: 'Reset kata sandi 1rumah.biz.id',
    html,
    text: `Reset kata sandi Anda: ${url}`,
    template: 'reset_password',
    userId: user.id,
    eventKey: `reset:${user.id}:${Date.now()}`,
    metadata: { userId: user.id }
  });
}

async function consumeEmailToken(prisma, token, type) {
  const tokenHash = hashToken(token || '');
  const row = await prisma.emailToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    return null;
  }

  await prisma.emailToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() }
  });

  return row.user;
}

async function notifyUser(prisma, user, template, subject, title, message, cta = null, metadata = {}, eventKey = null) {
  if (!user || !user.email) return null;
  const html = baseEmailHtml(title, `<p>${escapeHtml(message)}</p>`, cta);
  return sendEmail(prisma, {
    to: user.email,
    subject,
    html,
    text: message,
    template,
    userId: user.id,
    metadata,
    eventKey
  });
}

async function notifyAdmins(prisma, template, subject, title, message, cta = null, metadata = {}) {
  if (!await isTemplateEnabled(prisma, 'email_admin_notifications_enabled')) {
    return [];
  }

  const recipients = await getAdminRecipients(prisma);
  const html = baseEmailHtml(title, `<p>${escapeHtml(message)}</p>`, cta);
  const results = [];
  for (const to of recipients) {
    results.push(await sendEmail(prisma, {
      to,
      subject,
      html,
      text: message,
      template,
      metadata
    }));
  }
  return results;
}

module.exports = {
  isSmtpConfigured,
  getEmailSetting,
  setEmailSetting,
  getAdminRecipients,
  isTemplateEnabled,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  consumeEmailToken,
  notifyUser,
  notifyAdmins,
  baseEmailHtml,
  getSiteUrl
};
