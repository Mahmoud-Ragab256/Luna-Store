import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { renderEmail } from './email.template.js';
export async function sendAccountEmail(to, subject, text) {
  if (!env.SMTP_HOST) {
    logger.warn(
      { operation: subject },
      'Email delivery is not configured; account email was not sent.',
    );
    return { delivered: false };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html: renderEmail({
      subject,
      text,
      origin: env.CLIENT_ORIGIN,
      demoMode: env.DEMO_MODE === 'true',
    }),
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return { delivered: true };
}
