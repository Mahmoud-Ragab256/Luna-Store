const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

// Shared presentation adapter: queued plain text remains the source of truth.
export function renderEmail({ subject, text, origin, demoMode = false }) {
  const base = new URL(origin);
  const type =
    subject === 'Verify your LUNA email'
      ? 'verify'
      : subject === 'Reset your LUNA password'
        ? 'reset'
        : /^LUNA order .+ received$/.test(subject)
          ? 'order'
          : 'message';
  const variants = {
    verify: ['Welcome to LUNA', 'Verify your email', '/verify-email'],
    reset: ['A fresh start', 'Reset password', '/reset-password'],
    order: ['Your order, received', 'View your order', '/orders/'],
    message: [subject, 'Visit LUNA', '/'],
  };
  const [heading, label, path] = variants[type];
  let action = type === 'message' ? base.href : null;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    try {
      const candidate = new URL(match[0]);
      const validPath =
        type === 'order'
          ? /^\/orders\/[a-f\d]{24}$/i.test(candidate.pathname)
          : candidate.pathname === path;
      if (
        candidate.origin === base.origin &&
        validPath &&
        !candidate.username &&
        !candidate.password
      )
        action = candidate.href;
    } catch {
      /* Malformed links remain escaped text. */
    }
  }
  const content = text
    .split('\n')
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font:16px/1.7 Inter,Arial,sans-serif;color:#252525;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(line) || '&nbsp;'}</p>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.email-pad{padding:28px 22px!important}.email-title{font-size:32px!important}}a:focus-visible{outline:3px solid #B98686;outline-offset:4px}</style></head>
<body style="margin:0;padding:0;background:#FAF8F5;color:#252525">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5"><tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;table-layout:fixed">
<tr><td align="center" style="padding:12px 0 28px"><a href="${escapeHtml(base.href)}" style="font:40px Georgia,'Times New Roman',serif;letter-spacing:8px;text-decoration:none;color:#252525">LUNA</a></td></tr>
<tr><td bgcolor="#FFFFFF" class="email-pad" style="padding:44px 40px;border-top:3px solid #B98686">
<h1 class="email-title" style="margin:0 0 24px;font:38px/1.2 'Playfair Display',Georgia,serif;font-weight:400;color:#252525">${escapeHtml(heading)}</h1>
${content}
${action ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 20px"><tr><td bgcolor="#252525" align="center" style="mso-padding-alt:16px 28px"><a href="${escapeHtml(action)}" style="display:inline-block;padding:16px 28px;font:15px/20px Inter,Arial,sans-serif;color:#FFFFFF;text-decoration:none">${label}</a></td></tr></table>` : ''}
${type === 'reset' ? '<p style="font:14px/1.7 Inter,Arial,sans-serif;color:#555555">This link expires in 30 minutes. If you did not request a password reset, you can ignore this email.</p>' : ''}
${type === 'verify' ? '<p style="font:14px/1.7 Inter,Arial,sans-serif;color:#555555">If you did not create an account, you can ignore this email.</p>' : ''}
</td></tr>
<tr><td class="email-pad" bgcolor="#F4E8E6" style="padding:22px 40px;font:14px/1.7 Inter,Arial,sans-serif;color:#252525">${demoMode ? 'You are exploring the LUNA demonstration store. No real payments or deliveries are processed.' : 'Thank you for choosing LUNA.'}</td></tr>
<tr><td align="center" style="padding:26px 12px;font:13px/1.8 Inter,Arial,sans-serif;color:#555555">LUNA Women's Fashion<br><a href="${escapeHtml(new URL('/contact', base).href)}" style="color:#252525;text-decoration:underline">Contact us</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
