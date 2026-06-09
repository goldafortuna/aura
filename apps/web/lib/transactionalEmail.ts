import { sendViaResend, verifyResendApiKey } from './resendEmail';
import type { SmtpConfigInput } from './smtpEmail';
import { createSmtpTransport } from './smtpTransport';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type TransactionalEmailPayload = {
  config: SmtpConfigInput;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
};

function usesResendApi(config: SmtpConfigInput): boolean {
  return config.provider === 'resend' || config.smtpPassword.trim().startsWith('re_');
}

export async function verifyEmailConfig(config: SmtpConfigInput): Promise<void> {
  if (usesResendApi(config)) {
    await verifyResendApiKey(config.smtpPassword);
    return;
  }

  const transporter = createSmtpTransport(config);
  await transporter.verify();
}

export async function sendTransactionalEmail(payload: TransactionalEmailPayload): Promise<void> {
  const { config, to, subject, html, text, attachments } = payload;

  if (usesResendApi(config)) {
    if (!config.smtpPassword.trim()) {
      throw new Error('Resend API key belum diatur. Buka Pengaturan -> Email.');
    }
    if (!config.fromAddress.trim()) {
      throw new Error('From address belum diatur. Buka Pengaturan -> Email.');
    }

    await sendViaResend({
      apiKey: config.smtpPassword,
      fromName: config.fromName,
      fromAddress: config.fromAddress,
      to,
      subject,
      html,
      text,
      attachments,
    });
    return;
  }

  const transporter = createSmtpTransport(config);
  const toAddresses = Array.isArray(to) ? to : [to];

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to: toAddresses.join(', '),
    subject,
    html,
    text,
    attachments: attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
}
