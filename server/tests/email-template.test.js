import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/integrations/email/email.template.js';

const origin = 'https://luna-store-peach.vercel.app';
describe('transactional email presentation', () => {
  it('keeps verification tokens in a same-origin action and supplies accessible English markup', () => {
    const url = `${origin}/verify-email#token=sample-token`;
    const html = renderEmail({
      subject: 'Verify your LUNA email',
      text: `Verify your email: ${url}`,
      origin,
    });
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain('Welcome to LUNA');
    expect(html).toContain('role="presentation"');
  });
  it('escapes customer-controlled text and rejects off-origin action links', () => {
    const html = renderEmail({
      subject: 'Reset your LUNA password',
      text: '<img src=x onerror=alert(1)> https://evil.test/reset-password#token=x',
      origin,
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('href="https://evil.test');
    expect(html).not.toContain('>Reset password</a>');
  });
  it('preserves order/payment facts and a specific order action', () => {
    const text = `Order: LUNA-123\nTotal: EGP 1990.00\nPayment: Cash on delivery; payment pending collection\nTrack your order: ${origin}/orders/0123456789abcdef01234567`;
    const html = renderEmail({
      subject: 'LUNA order LUNA-123 received',
      text,
      origin,
      demoMode: true,
    });
    expect(html).toContain('EGP 1990.00');
    expect(html).toContain('payment pending collection');
    expect(html).toContain('View your order');
    expect(html).toContain('No real payments or deliveries');
  });
  it('shows reset expiry without adding demo claims to non-demo messages', () => {
    const html = renderEmail({
      subject: 'Reset your LUNA password',
      text: `${origin}/reset-password#token=demo`,
      origin,
    });
    expect(html).toContain('expires in 30 minutes');
    expect(html).not.toContain('demonstration store');
  });
});
