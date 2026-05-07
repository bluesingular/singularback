/**
 * server/src/notifications/email.ts
 *
 * Gap E — Email delivery via Resend.
 * Only fires if RESEND_API_KEY is set in the environment.
 * Gracefully skips (logs warning) when unconfigured.
 */

import pino from "pino";

const log = pino({ name: "notifications:email" });

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  const apiKey  = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "Swwarm <noreply@swwarm.com>";

  if (!apiKey) {
    log.warn({ to: payload.to, subject: payload.subject },
      "notifications:email: RESEND_API_KEY not set — skipping email delivery");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  log.info({ to: payload.to, subject: payload.subject }, "notifications:email: sent");
}

function notificationHtml(title: string, body: string, actionUrl?: string | null): string {
  const cta = actionUrl
    ? `<p style="margin-top:24px">
         <a href="${actionUrl}" style="background:#1A9E68;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">
           Voir →
         </a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family:'DM Sans',Helvetica,Arial,sans-serif;background:#FAFAF8;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E8E4DC">
    <p style="font-size:22px;font-family:Georgia,serif;margin:0 0 8px;color:#0F0F0D">${title}</p>
    <p style="font-size:15px;color:#4B4846;margin:0 0 8px;line-height:1.6">${body}</p>
    ${cta}
    <hr style="margin:28px 0;border:none;border-top:1px solid #E8E4DC"/>
    <p style="font-size:12px;color:#8A8680;margin:0">
      Vous recevez cet email car vous êtes membre de votre équipe Swwarm.<br/>
      Gérez vos préférences de notification dans vos paramètres.
    </p>
  </div>
</body>
</html>`;
}

export async function sendNotificationEmail(opts: {
  to: string;
  title: string;
  body: string;
  actionUrl?: string | null;
}): Promise<void> {
  await sendViaResend({
    to: opts.to,
    subject: opts.title,
    html: notificationHtml(opts.title, opts.body, opts.actionUrl),
  });
}
