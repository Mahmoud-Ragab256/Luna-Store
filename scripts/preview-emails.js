import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { renderEmail } from '../server/src/integrations/email/email.template.js';

const origin = 'https://luna-store-peach.vercel.app';
const examples = [
  [
    'verify',
    'Verify your LUNA email',
    `Verify your email: ${origin}/verify-email#token=preview-only`,
  ],
  [
    'reset',
    'Reset your LUNA password',
    `Reset your password: ${origin}/reset-password#token=preview-only`,
  ],
  [
    'order',
    'LUNA order LUNA-EXAMPLE received',
    `Thank you for your order, Alex.\n\nOrder: LUNA-EXAMPLE\nTotal: EGP 1990.00\nPayment: Cash on delivery; payment pending collection\n\nTrack your order: ${origin}/orders/0123456789abcdef01234567`,
  ],
];
await mkdir('artifacts/emails', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, subject, text] of examples) {
    const html = renderEmail({ subject, text, origin, demoMode: true });
    await writeFile(`artifacts/emails/${name}.html`, html);
    for (const width of [390, 900]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.setContent(html);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error(`${name} overflows at ${width}`);
      await page
        .getByRole('link', {
          name:
            name === 'verify'
              ? 'Verify your email'
              : name === 'reset'
                ? 'Reset password'
                : 'View your order',
          exact: true,
        })
        .focus();
      await page.screenshot({ path: `artifacts/emails/${name}-${width}.png`, fullPage: true });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log('Three email variants checked at 390px and 900px. No email sent.');
