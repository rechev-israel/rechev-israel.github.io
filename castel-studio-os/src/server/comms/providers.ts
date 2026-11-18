/**
 * Real outbound providers. Each adapter is "configured" only when its credentials exist in environment variables.
 * Nothing here is simulated: if a provider is not configured, sending is refused and the message stays APPROVED
 * (waiting for a provider) — it is never reported as sent.
 */
import { logger } from "@/lib/logger";
import { secret } from "@/server/secrets/store";
import { WA_LANG, WA_TEMPLATES, templateComponents } from "./whatsapp-templates";

function waPayload(to: string, body: string, templateKey?: string | null, vars?: Record<string, unknown>) {
  const t = templateKey ? WA_TEMPLATES[templateKey] : undefined;
  if (t) return { messaging_product: "whatsapp", to, type: "template", template: { name: t.name, language: { code: WA_LANG }, components: templateComponents(templateKey!, vars ?? {}) } };
  return { messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } };
}

export type SendResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string; retryable: boolean };

export interface ChannelProvider {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  configured(): boolean;
  send(msg: { to: string; subject?: string | null; body: string; templateKey?: string | null; vars?: Record<string, unknown> }): Promise<SendResult>;
}

/** Meta WhatsApp Business Cloud API. Note: business-initiated messages outside the 24h service window
 * require pre-approved message templates on Meta's side; such sends are rejected by Meta and recorded as FAILED. */
const whatsapp: ChannelProvider = {
  id: "whatsapp-cloud",
  channel: "WHATSAPP",
  // Hard kill switch: WhatsApp sending stays OFF until the owner sets WHATSAPP_SENDING_ENABLED=true
  // (the business WhatsApp account currently has a restriction). Credentials alone never enable sending.
  configured: () =>
    process.env.WHATSAPP_SENDING_ENABLED === "true" &&
    Boolean(secret("WHATSAPP_CLOUD_ACCESS_TOKEN") && secret("WHATSAPP_PHONE_NUMBER_ID")),
  async send({ to, body, templateKey, vars }) {
    const phoneId = secret("WHATSAPP_PHONE_NUMBER_ID");
    const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
    try {
      const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret("WHATSAPP_CLOUD_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
        // Business-initiated messages must use an approved template; free text works only inside the 24h service window.
        body: JSON.stringify(waPayload(to.replace(/^\+/, ""), body, templateKey, vars)),
      });
      const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) return { ok: false, error: data.error?.message ?? `HTTP ${res.status}`, retryable: res.status >= 500 || res.status === 429 };
      return { ok: true, providerMessageId: data.messages?.[0]?.id ?? null };
    } catch (e) {
      logger.warn("whatsapp.send_failed", { err: String(e) });
      return { ok: false, error: "network error", retryable: true };
    }
  },
};

/** Any SMTP server, configured with SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465) and SMTP_FROM. */
const email: ChannelProvider = {
  id: "smtp",
  channel: "EMAIL",
  configured: () => Boolean(secret("SMTP_URL")),
  async send({ to, subject, body }) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(secret("SMTP_URL"));
      const info = await transport.sendMail({
        from: secret("SMTP_FROM") || "CASTEL STUDIO <no-reply@castel.studio>",
        to,
        subject: subject || "CASTEL STUDIO",
        text: body,
      });
      return { ok: true, providerMessageId: info.messageId ?? null };
    } catch (e) {
      logger.warn("smtp.send_failed", { err: String(e) });
      return { ok: false, error: String(e).slice(0, 300), retryable: true };
    }
  },
};

export const PROVIDERS: Record<"WHATSAPP" | "EMAIL", ChannelProvider> = { WHATSAPP: whatsapp, EMAIL: email };

export function providerFor(channel: string): ChannelProvider | null {
  return channel === "WHATSAPP" || channel === "EMAIL" ? PROVIDERS[channel] : null;
}
