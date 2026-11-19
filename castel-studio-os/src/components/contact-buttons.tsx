import { MessageCircle, Phone } from "lucide-react";

/** wa.me needs the international number without "+" or leading zeros: +972 52… / 052… → 97252… */
export function whatsappNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}
export const whatsappLink = (phone: string) => `https://wa.me/${whatsappNumber(phone)}`;

/** Call + WhatsApp for a customer's phone. `compact` = round icon buttons (lists). */
export function ContactButtons({ phone, he, compact = false, className = "" }: { phone: string | null | undefined; he: boolean; compact?: boolean; className?: string }) {
  if (!phone) return null;
  const base = compact
    ? "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors"
    : "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <a href={`tel:${phone}`} className={`${base} border-border text-text hover:border-gold hover:text-gold`} aria-label={he ? `חיוג ל-${phone}` : `Call ${phone}`}>
        <Phone size={compact ? 16 : 15} />{!compact && (he ? "חיוג" : "Call")}
      </a>
      <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className={`${base} border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20`} aria-label={he ? `וואטסאפ ל-${phone}` : `WhatsApp ${phone}`}>
        <MessageCircle size={compact ? 16 : 15} />{!compact && "WhatsApp"}
      </a>
    </span>
  );
}
