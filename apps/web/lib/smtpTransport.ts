import nodemailer from 'nodemailer';

import type { SmtpConfigInput } from './smtpEmail';

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
