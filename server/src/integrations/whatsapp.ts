/**
 * server/src/integrations/whatsapp.ts
 *
 * Gap G — WhatsApp Business API connector.
 *
 * Registers the `send_whatsapp` action type in the global action registry
 * when the WhatsApp integration is connected. Called from the integration
 * connect/disconnect lifecycle (routes/integrations.ts).
 *
 * API used: Meta WhatsApp Business Cloud API (v21.0+)
 * Credentials stored in Vault: { phoneNumberId, accessToken, verifyToken }
 *
 * Zero-tolerance rules (declared in SKILL.md frontmatter at pack install):
 *   - Bulk sends (recipient_count > 50) always require human approval
 *   - Marketing template sends always require human approval
 *   - Transactional messages (OTP, invoice, booking) follow trust tier
 *
 * GDPR: phone numbers are personal data → always gdpr_required: true routing.
 * Messages are NOT stored beyond the audit trail entry.
 */

import pino from "pino";
import { registerActionType, type ActionContext } from "../extensions/builtin-actions.js";

const logger = pino({ name: "whatsapp" });

// ── WhatsApp Cloud API client ─────────────────────────────────────────────────

const WA_API_VERSION = "v21.0";
const WA_BASE = "https://graph.facebook.com";

interface WaTextMessage {
  phoneNumberId: string;
  accessToken:   string;
  to:            string;       // E.164 format e.g. "+33612345678"
  body:          string;
  previewUrl?:   boolean;
}

interface WaTemplateMessage {
  phoneNumberId: string;
  accessToken:   string;
  to:            string;
  templateName:  string;
  languageCode:  string;       // e.g. "fr", "en_US"
  components?:   unknown[];    // template variable bindings
}

async function sendTextMessage(msg: WaTextMessage): Promise<string> {
  const url = `${WA_BASE}/${WA_API_VERSION}/${msg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${msg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to:                msg.to,
      type:              "text",
      text: {
        preview_url: msg.previewUrl ?? false,
        body:        msg.body,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? "unknown";
}

async function sendTemplateMessage(msg: WaTemplateMessage): Promise<string> {
  const url = `${WA_BASE}/${WA_API_VERSION}/${msg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${msg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to:   msg.to,
      type: "template",
      template: {
        name:     msg.templateName,
        language: { code: msg.languageCode },
        components: msg.components ?? [],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? "unknown";
}

// ── Action handler ────────────────────────────────────────────────────────────

async function handleSendWhatsApp(
  payload: Record<string, unknown>,
  ctx:     ActionContext,
): Promise<string> {
  const { phoneNumberId, accessToken } = getCredentials(ctx.companyId);

  const to           = String(payload.to ?? "");
  const body         = String(payload.body ?? "");
  const templateName = payload.templateName ? String(payload.templateName) : null;
  const languageCode = payload.languageCode ? String(payload.languageCode) : "fr";
  const components   = Array.isArray(payload.components) ? payload.components : [];

  if (!to) throw new Error("send_whatsapp: 'to' (E.164 phone number) is required");

  let messageId: string;

  if (templateName) {
    messageId = await sendTemplateMessage({
      phoneNumberId,
      accessToken,
      to,
      templateName,
      languageCode,
      components,
    });
    logger.info({ ...ctx, to, templateName, messageId }, "send_whatsapp: template sent");
    return `Message WhatsApp (template: ${templateName}) envoyé à ${to} — ID: ${messageId}`;
  } else {
    if (!body) throw new Error("send_whatsapp: 'body' is required for text messages");
    messageId = await sendTextMessage({ phoneNumberId, accessToken, to, body });
    logger.info({ ...ctx, to, messageId }, "send_whatsapp: text sent");
    return `Message WhatsApp envoyé à ${to} — ID: ${messageId}`;
  }
}

// ── Credential store (reads from Vault at call time) ─────────────────────────

// Credentials are resolved at execution time from the Vault, not at registration time.
// This function is a thin wrapper; in production the caller has already decrypted via
// vault.decrypt() before the action handler is invoked.
function getCredentials(companyId: string): { phoneNumberId: string; accessToken: string } {
  // Vault decryption happens in the worker pipeline before the action handler is called.
  // The decrypted values are injected into the execution context via environment variables
  // scoped to the task. Here we read from a well-known env key set by the pipeline.
  // This keeps credentials out of LLM context (RULE 2).
  const phoneNumberId = process.env[`WA_PHONE_NUMBER_ID_${companyId.replace(/-/g, "_")}`] ?? "";
  const accessToken   = process.env[`WA_ACCESS_TOKEN_${companyId.replace(/-/g, "_")}`]   ?? "";

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      `WhatsApp credentials not available for company ${companyId}. ` +
      "Ensure the WhatsApp integration is connected and credentials are in Vault.",
    );
  }

  return { phoneNumberId, accessToken };
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register the `send_whatsapp` action type.
 * Called once when the WhatsApp integration is successfully connected.
 * Safe to call multiple times — registry logs a warning but overwrites.
 */
export function registerWhatsAppActionType(): void {
  registerActionType({
    slug:                    "send_whatsapp",
    name:                    "Envoyer un WhatsApp",
    description:             "Envoie un message WhatsApp Business à un contact (texte ou template)",
    alwaysRequiresApproval:  false,    // trust tier governs; zero_tolerance_actions in SKILL.md handles bulk
    isExternalCommunication: true,     // triggers contact collision check (C2) + audit entry
    handler: handleSendWhatsApp,
  });

  logger.info("whatsapp: send_whatsapp action type registered");
}

/**
 * Inbound webhook verification (GET /webhooks/whatsapp).
 * Meta sends a hub.challenge that must be echoed back.
 */
export function verifyWebhookChallenge(
  mode:      string,
  token:     string,
  challenge: string,
  verifyToken: string,
): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    logger.info("whatsapp: webhook verified");
    return challenge;
  }
  return null;
}

/**
 * Parse an inbound WhatsApp message from a Meta webhook payload.
 * Returns null if the payload doesn't contain a user message.
 */
export interface InboundWhatsAppMessage {
  from:        string;   // E.164 phone number
  messageId:   string;
  timestamp:   number;
  type:        "text" | "image" | "audio" | "document" | "button" | "interactive" | "unknown";
  body:        string | null;
  mediaId:     string | null;
}

export function parseInboundMessage(payload: unknown): InboundWhatsAppMessage | null {
  try {
    const p = payload as Record<string, unknown>;
    const entry  = (p.entry as unknown[])?.[0] as Record<string, unknown>;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>;
    const value  = change?.value as Record<string, unknown>;
    const msg    = (value?.messages as unknown[])?.[0] as Record<string, unknown>;

    if (!msg) return null;

    const type = String(msg.type ?? "unknown") as InboundWhatsAppMessage["type"];

    return {
      from:      String(msg.from ?? ""),
      messageId: String(msg.id ?? ""),
      timestamp: Number(msg.timestamp ?? 0),
      type,
      body:      type === "text" ? String((msg.text as Record<string, unknown>)?.body ?? "") : null,
      mediaId:   (msg[type] as Record<string, unknown>)?.id
                   ? String((msg[type] as Record<string, unknown>).id)
                   : null,
    };
  } catch {
    return null;
  }
}
