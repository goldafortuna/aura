import { Resend } from 'resend';

type ResendEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

const RESEND_SEND_ONLY_KEY_ERROR = 'restricted to only send emails';

function isValidResendKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('re_') && apiKey.length >= 20;
}

function isResendSendOnlyKeyError(message: string | undefined): boolean {
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes(RESEND_SEND_ONLY_KEY_ERROR) || normalized.includes('only send emails');
}

export async function verifyResendApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!isValidResendKeyFormat(trimmed)) {
    throw new Error('Format API key Resend tidak valid. Pastikan dimulai dengan re_.');
  }

  const resend = new Resend(trimmed);
  const { error } = await resend.domains.list();

  if (!error) return;

  // API key "Sending access" tidak bisa list domain, tetapi valid untuk kirim email.
  if (isResendSendOnlyKeyError(error.message)) return;

  throw new Error(error.message || 'API key Resend tidak valid.');
}

function encodeResendAttachmentContent(content: Buffer): string {
  return content.toString('base64');
}

export async function sendViaResend(params: {
  apiKey: string;
  fromName: string;
  fromAddress: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: ResendEmailAttachment[];
}): Promise<void> {
  const resend = new Resend(params.apiKey.trim());
  const to = Array.isArray(params.to) ? params.to : [params.to];

  const { error } = await resend.emails.send({
    from: `${params.fromName} <${params.fromAddress}>`,
    to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: encodeResendAttachmentContent(attachment.content),
      contentType: attachment.contentType,
    })),
  });

  if (error) {
    throw new Error(error.message || 'Gagal mengirim email via Resend.');
  }
}
