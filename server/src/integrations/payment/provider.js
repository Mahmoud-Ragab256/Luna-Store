import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
/** Provider contract: createTransaction, verifyWebhook, verifyTransaction, refund.
 * Live adapters must verify status through authenticated server-to-server requests.
 * Browser redirects are never payment evidence. Unconfigured providers fail closed.
 */
const disabled = {
  name: 'disabled',
  available: false,
  developmentOnly: false,
  async createTransaction() {
    throw new AppError(503, 'Online payments are not configured.');
  },
  verifyWebhook() {
    return false;
  },
  async verifyTransaction() {
    throw new AppError(503, 'Payment verification is not configured.');
  },
  async refund() {
    throw new AppError(501, 'Provider refunds are not configured.');
  },
};
const mock = {
  name: 'development-mock',
  available: true,
  developmentOnly: true,
  async createTransaction({ amount, currency }) {
    return {
      provider: 'development-mock',
      providerTransactionId: `mock_${randomUUID()}`,
      amount,
      currency,
      status: 'pending',
    };
  },
  verifyWebhook(rawBody, signature, secret) {
    if (!secret || !/^[a-f\d]{64}$/i.test(signature || '')) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
  },
  async verifyTransaction(transaction, event) {
    return (
      transaction.providerStatus === event.status &&
      transaction.amount === event.amount &&
      transaction.currency === event.currency
    );
  },
  async refund() {
    throw new AppError(501, 'The development adapter does not issue real refunds.');
  },
};
export function getPaymentProvider() {
  return (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') &&
    process.env.PAYMENT_PROVIDER === 'mock'
    ? mock
    : disabled;
}
