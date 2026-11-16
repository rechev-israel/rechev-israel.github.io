import type { Customer } from "@prisma/client";
import type { Dictionary } from "@/i18n/he";
import { Input, Label, Select, Textarea } from "@/components/ui";
import { FieldError } from "@/components/forms";
import { toLocalInput } from "@/lib/dates";

export function CustomerFields({ t, c }: { t: Dictionary; c?: Customer | null }) {
  const consentSel = (name: "marketingConsentSms" | "marketingConsentEmail" | "marketingConsentWhatsapp", label: string) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={c?.[name] ?? "UNKNOWN"}>
        {(["UNKNOWN", "OPTED_IN", "OPTED_OUT"] as const).map((v) => <option key={v} value={v}>{t.consent[v]}</option>)}
      </Select>
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="firstName">{t.common.firstName} *</Label>
        <Input id="firstName" name="firstName" defaultValue={c?.firstName} required maxLength={80} />
        <FieldError name="firstName" />
      </div>
      <div>
        <Label htmlFor="lastName">{t.common.lastName}</Label>
        <Input id="lastName" name="lastName" defaultValue={c?.lastName ?? ""} maxLength={80} />
      </div>
      <div>
        <Label htmlFor="phone">{t.common.phone}</Label>
        <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={c?.phone ?? ""} placeholder="050-1234567" />
        <FieldError name="phone" />
      </div>
      <div>
        <Label htmlFor="email">{t.common.email}</Label>
        <Input id="email" name="email" type="email" dir="ltr" defaultValue={c?.email ?? ""} />
        <FieldError name="email" />
      </div>
      <div>
        <Label htmlFor="birthday">{t.crm.birthday}</Label>
        <Input id="birthday" name="birthday" type="date" defaultValue={c?.birthday ? c.birthday.toISOString().slice(0, 10) : ""} />
      </div>
      <div>
        <Label htmlFor="source">{t.common.source}</Label>
        <Input id="source" name="source" defaultValue={c?.source ?? ""} list="sources" />
        <datalist id="sources">
          {["instagram", "tiktok", "walk-in", "referral", "booking-app", "google"].map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="preferences">{t.crm.preferences}</Label>
        <Textarea id="preferences" name="preferences" defaultValue={c?.preferences ?? ""} />
      </div>
      <div>
        <Label htmlFor="tags">{t.crm.tags}</Label>
        <Input id="tags" name="tags" defaultValue={c?.tags.join(", ") ?? ""} />
      </div>
      {c && (
        <div>
          <Label htmlFor="status">{t.crm.segment}</Label>
          <Select id="status" name="status" defaultValue={c.status}>
            {(["ACTIVE", "AT_RISK", "LAPSED", "VIP", "BLOCKED"] as const).map((s) => <option key={s} value={s}>{t.segments[s]}</option>)}
          </Select>
        </div>
      )}
      <fieldset className="md:col-span-2 rounded-xl border border-border p-4">
        <legend className="px-2 text-xs font-medium text-gold">{t.crm.consent}</legend>
        <p className="mb-3 text-[11px] text-muted">{t.crm.consentNote}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {consentSel("marketingConsentWhatsapp", "WhatsApp")}
          {consentSel("marketingConsentSms", "SMS")}
          {consentSel("marketingConsentEmail", t.common.email)}
        </div>
        {c?.consentUpdatedAt && <p className="mt-2 text-[11px] text-muted" dir="ltr">updated {toLocalInput(c.consentUpdatedAt)}</p>}
      </fieldset>
    </div>
  );
}

export function segmentTone(s: string) {
  return s === "VIP" ? "gold" : s === "AT_RISK" ? "warning" : s === "LAPSED" ? "danger" : s === "BLOCKED" ? "neutral" : "success";
}
