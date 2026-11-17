/**
 * Real outbound providers. Each adapter is "configured" only when its credentials exist in environment variables.
 * Nothing here is simulated: if a provider is not configured, sending is refused and the message stays APPROVED
 * (waiting for a provider) — it is never reported as sent.
 */
import { logger } from "@/lib/logger";

export type SendResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string; retryable: boolean };

export interface ChannelProvider {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  configured(): boolean;
  send(msg: { to: string; subject?: string | null; body: string }): Promise<SendResult>;
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
    Boolean(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
  async send({ to, body }) {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
    const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
    try {
      const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_ACCESS_TOKEN!.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body, preview_url: false } }),
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
  configured: () => Boolean(process.env.SMTP_URL?.trim()),
  async send({ to, subject, body }) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(process.env.SMTP_URL!.trim());
      const info = await transport.sendMail({
        from: process.env.SMTP_FROM?.trim() || "CASTEL STUDIO <no-reply@castel.studio>",
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
