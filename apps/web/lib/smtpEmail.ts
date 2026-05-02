import nodemailer from 'nodemailer';
import type { EmailConfig } from '../db/schema';

export type SmtpProvider = 'gmail' | 'resend' | 'custom';

export type SmtpConfigInput = {
  provider: SmtpProvider;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  fromAddress: string;
  fromName: string;
};

export type CtaSummary = {
  title: string;
  action: string;
  picName?: string | null;
  unit?: string | null;
  deadline?: string | null;
  priority: 'low' | 'medium' | 'high';
};

export type NotulaEmailPayload = {
  from: SmtpConfigInput;
  to: string | string[];
  subject: string;
  notula: {
    title: string;
    meetingDate: string;
    participantsCount?: number;
  };
  additionalMessage?: string;
  ctas?: CtaSummary[];
  downloadUrl?: string;
};

export function maskSecret(secret: string): string {
  return secret ? `****${secret.slice(-4)}` : '';
}

export function resolveStoredSmtpConfig(
  cfg: EmailConfig,
  decryptValue: (value: string) => string,
): SmtpConfigInput {
  const decryptedLegacyPassword = decryptValue(cfg.gmailAppPassword);
  const decryptedSmtpPassword = cfg.smtpPassword ? decryptValue(cfg.smtpPassword) : '';

  return {
    provider: normalizeProvider(cfg.provider),
    smtpHost: cfg.smtpHost ?? inferLegacyHost(cfg.provider),
    smtpPort: cfg.smtpPort ?? inferLegacyPort(cfg.provider),
    smtpSecure: cfg.smtpHost ? cfg.smtpSecure : inferLegacySecure(cfg.provider),
    smtpUsername: cfg.smtpUsername ?? cfg.gmailAddress,
    smtpPassword: decryptedSmtpPassword || decryptedLegacyPassword,
    fromAddress: cfg.fromAddress ?? cfg.gmailAddress,
    fromName: cfg.fromName,
  };
}

export async function verifySmtpConfig(config: SmtpConfigInput): Promise<void> {
  const transporter = createSmtpTransport(config);
  await transporter.verify();
}

export async function sendNotulaEmail(payload: NotulaEmailPayload): Promise<void> {
  const transporter = createSmtpTransport(payload.from);
  const html = buildHtmlBody(payload);
  const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to];

  await transporter.sendMail({
    from: `"${payload.from.fromName}" <${payload.from.fromAddress}>`,
    to: toAddresses.join(', '),
    subject: payload.subject,
    html,
    text: `Notula Rapat: ${payload.notula.title}\nTanggal: ${payload.notula.meetingDate}\n\n${payload.additionalMessage ?? ''}`,
  });
}

export function createSmtpTransport(config: SmtpConfigInput) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
}

function normalizeProvider(provider: string | null | undefined): SmtpProvider {
  if (provider === 'resend' || provider === 'custom') return provider;
  return 'gmail';
}

function inferLegacyHost(provider: string | null | undefined): string {
  return normalizeProvider(provider) === 'resend' ? 'smtp.resend.com' : 'smtp.gmail.com';
}

function inferLegacyPort(provider: string | null | undefined): number {
  return normalizeProvider(provider) === 'resend' ? 465 : 587;
}

function inferLegacySecure(provider: string | null | undefined): boolean {
  return normalizeProvider(provider) === 'resend';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function priorityBadge(p: 'low' | 'medium' | 'high') {
  const map = {
    high: { bg: '#fee2e2', text: '#b91c1c', label: 'Tinggi' },
    medium: { bg: '#ffedd5', text: '#c2410c', label: 'Sedang' },
    low: { bg: '#dcfce7', text: '#15803d', label: 'Rendah' },
  };
  const s = map[p];
  return `<span style="background:${s.bg};color:${s.text};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${s.label}</span>`;
}

function buildHtmlBody(payload: NotulaEmailPayload): string {
  const { notula, additionalMessage, ctas, downloadUrl } = payload;

  const ctaRows =
    ctas && ctas.length > 0
      ? ctas
          .map(
            (cta, i) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:12px 16px;font-size:13px;color:#111827;">
            <strong>${i + 1}. ${escapeHtml(cta.title)}</strong><br/>
            <span style="color:#6b7280;">${escapeHtml(cta.action)}</span>
          </td>
          <td style="padding:12px 8px;font-size:12px;color:#374151;white-space:nowrap;">${escapeHtml(cta.unit ?? '-')}</td>
          <td style="padding:12px 8px;font-size:12px;color:#374151;white-space:nowrap;">${escapeHtml(cta.picName ?? '-')}</td>
          <td style="padding:12px 8px;font-size:12px;white-space:nowrap;">${escapeHtml(cta.deadline ?? '-')}</td>
          <td style="padding:12px 8px;">${priorityBadge(cta.priority)}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">Tidak ada tindak lanjut untuk unit Anda pada rapat ini.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Notula Rapat</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:32px 40px;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.75);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Notulen Rapat</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(notula.title)}</h1>
      <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
        ${notula.meetingDate}
        ${notula.participantsCount ? ` | ${notula.participantsCount} peserta` : ''}
      </p>
    </div>

    <div style="padding:32px 40px;">
      ${
        additionalMessage
          ? `<div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(additionalMessage).replace(/\n/g, '<br/>')}</p>
            </div>`
          : ''
      }

      <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">Tindak Lanjut (Call to Action)</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        Berikut tindak lanjut yang perlu ditindaklanjuti oleh unit Anda berdasarkan hasil rapat:
      </p>

      <div style="overflow-x:auto;border-radius:10px;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;font-family:inherit;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Tindak Lanjut</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Unit</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">PIC</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Deadline</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Prioritas</th>
            </tr>
          </thead>
          <tbody>${ctaRows}</tbody>
        </table>
      </div>

      ${
        downloadUrl
          ? `<div style="margin-top:24px;text-align:center;">
              <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;">
                Unduh Dokumen Notula
              </a>
            </div>`
          : ''
      }
    </div>

    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Email ini dikirim secara otomatis oleh Sistem Sekretariat. Harap tidak membalas email ini.<br/>
        Jika ada pertanyaan, hubungi sekretariat langsung.
      </p>
    </div>
  </div>
</body>
</html>`;
}
