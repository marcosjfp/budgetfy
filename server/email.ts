/**
 * Transactional email through Resend's HTTP API (no SDK needed).
 *
 * Without RESEND_API_KEY (local development) messages are printed to the server log instead,
 * so the verification / reset links can still be clicked.
 */
import { config } from './config.js';

export type EmailLang = 'en' | 'pt';

interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(message: Message): Promise<void> {
  if (!config.email.resendApiKey) {
    console.log(`[email] (not sent: RESEND_API_KEY unset) to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.email.from, ...message }),
  });
  if (!res.ok) {
    // Resend's error explains e.g. "You can only send testing emails to your own email address".
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Simple, email-client-safe layout: one message, one button, the link as text. */
function layout(lang: EmailLang, heading: string, body: string, button: string, link: string, footer: string): Pick<Message, 'html' | 'text'> {
  const html = `<!doctype html><html lang="${lang === 'pt' ? 'pt-BR' : 'en'}"><body style="margin:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;color:#4f46e5;padding-bottom:16px">BudgetFy</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${escapeHtml(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;padding-bottom:24px">${escapeHtml(body)}</td></tr>
<tr><td><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escapeHtml(button)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#71717a;padding-top:24px;word-break:break-all">${escapeHtml(footer)}<br><a href="${escapeHtml(link)}" style="color:#4f46e5">${escapeHtml(link)}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${heading}\n\n${body}\n\n${button}: ${link}\n\n${footer}`;
  return { html, text };
}

const COPY = {
  verify: {
    en: {
      subject: 'Confirm your email for BudgetFy',
      heading: (name: string) => `Hi ${name}, confirm your email`,
      body: 'Click the button below to confirm this is your email address. The link works for 48 hours.',
      button: 'Confirm email',
      footer: "If you didn't create a BudgetFy account, you can ignore this email. If the button doesn't work, open this link:",
    },
    pt: {
      subject: 'Confirme seu e-mail no BudgetFy',
      heading: (name: string) => `Olá, ${name}! Confirme seu e-mail`,
      body: 'Clique no botão abaixo para confirmar que este é o seu e-mail. O link vale por 48 horas.',
      button: 'Confirmar e-mail',
      footer: 'Se você não criou uma conta no BudgetFy, ignore este e-mail. Se o botão não funcionar, abra este link:',
    },
  },
  reset: {
    en: {
      subject: 'Reset your BudgetFy password',
      heading: (name: string) => `Hi ${name}, reset your password`,
      body: 'Someone (hopefully you) asked to reset your BudgetFy password. The link works for 1 hour and can be used once.',
      button: 'Choose a new password',
      footer: "If you didn't ask for this, ignore this email; your password stays the same. If the button doesn't work, open this link:",
    },
    pt: {
      subject: 'Redefina sua senha do BudgetFy',
      heading: (name: string) => `Olá, ${name}! Redefina sua senha`,
      body: 'Alguém (esperamos que você) pediu para redefinir sua senha do BudgetFy. O link vale por 1 hora e só pode ser usado uma vez.',
      button: 'Escolher nova senha',
      footer: 'Se não foi você, ignore este e-mail; sua senha continua a mesma. Se o botão não funcionar, abra este link:',
    },
  },
} as const;

/** Sends the "confirm your email" or "reset your password" email. */
export async function sendAccountEmail(kind: 'verify' | 'reset', to: string, name: string, token: string, lang: EmailLang): Promise<void> {
  if (!config.appUrl) throw new Error('APP_URL is not configured');
  const copy = COPY[kind][lang];
  const path = kind === 'verify' ? '/verify-email' : '/reset-password';
  const link = `${config.appUrl}${path}?token=${encodeURIComponent(token)}`;
  await send({ to, subject: copy.subject, ...layout(lang, copy.heading(name || to.split('@')[0]), copy.body, copy.button, link, copy.footer) });
}
