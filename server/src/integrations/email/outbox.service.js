import { randomUUID } from 'node:crypto';
import { EmailJob } from '../../database/models.js';
import { env } from '../../config/env.js';
import { sendAccountEmail } from './email.service.js';

export async function enqueueEmail({ key = randomUUID(), to, subject, text }, session = null) {
  return EmailJob.updateOne(
    { key },
    { $setOnInsert: { key, to, subject, text } },
    { upsert: true, session },
  );
}

export async function queueAccountEmail(to, subject, text) {
  await enqueueEmail({ to, subject, text });
  return deliverEmailOutbox({ limit: 1 });
}

// A lease prevents concurrent invocations from sending the same job simultaneously.
// SMTP has no idempotency key: a process crash after acceptance may cause a retry.
export async function deliverEmailOutbox({
  send = sendAccountEmail,
  limit = 10,
  now = new Date(),
} = {}) {
  if (
    send === sendAccountEmail &&
    (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM)
  )
    return { sent: 0, failed: 0, configured: false };
  const result = { sent: 0, failed: 0, configured: true };
  for (let i = 0; i < limit; i++) {
    const job = await EmailJob.findOneAndUpdate(
      {
        attempts: { $lt: 12 },
        $or: [
          { status: 'pending', availableAt: { $lte: now } },
          { status: 'sending', leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: 'sending', leaseUntil: new Date(now.getTime() + 120000) },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { availableAt: 1 } },
    );
    if (!job) break;
    try {
      const delivery = await send(job.to, job.subject, job.text);
      if (!delivery.delivered) throw new Error('Email delivery is unavailable');
      await EmailJob.updateOne(
        { _id: job._id, status: 'sending', attempts: job.attempts },
        { $set: { status: 'sent', sentAt: new Date() }, $unset: { leaseUntil: 1, lastError: 1 } },
      );
      result.sent++;
    } catch {
      await EmailJob.updateOne(
        { _id: job._id, status: 'sending', attempts: job.attempts },
        {
          $set: {
            status: job.attempts >= 12 ? 'failed' : 'pending',
            availableAt: new Date(now.getTime() + Math.min(86400, 60 * 2 ** job.attempts) * 1000),
            lastError: 'SMTP delivery failed; check provider logs and configuration.',
          },
          $unset: { leaseUntil: 1 },
        },
      );
      result.failed++;
    }
  }
  return result;
}
