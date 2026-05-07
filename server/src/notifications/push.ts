/**
 * Gap H — WebPush sender.
 *
 * Reads VAPID keys from environment. If not configured, silently skips.
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT must all be set.
 */

import webpush from "web-push";
import pino from "pino";

const log = pino({ name: "push:send" });

const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject    = process.env.VAPID_SUBJECT ?? "mailto:ops@swwarm.com";

let vapidConfigured = false;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
} else {
  log.warn("VAPID keys not configured — WebPush disabled");
}

export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<void> {
  if (!vapidConfigured) return;

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: 86400 },
    );
  } catch (err: any) {
    // 410 Gone = subscription expired; log and continue
    if (err?.statusCode === 410) {
      log.info({ endpoint: sub.endpoint }, "push subscription expired");
    } else {
      log.error({ err, endpoint: sub.endpoint }, "push send failed");
    }
  }
}
