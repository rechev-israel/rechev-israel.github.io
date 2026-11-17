"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui";

type Cond = { field: string; op: string; value?: string };
type Act = Record<string, string | number | undefined> & { type: string };

const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "exists", "not_exists", "contains", "in"];
const FIELDS = ["customer.status", "customer.visitCount", "customer.source", "customer.tags", "customer.consentWhatsapp", "customer.phone", "customer.email", "appointment.price", "appointment.serviceName", "lead.kind", "lead.source", "lead.status", "campaign.channel", "campaign.budget"];

export function DefinitionEditor({ initial, labels, templates, isHe }: {
  initial: { conditions: Cond[]; actions: Act[] };
  labels: Record<string, string>;
  templates: { key: string; name: string }[];
  isHe: boolean;
}) {
  const [conds, setConds] = useState<Cond[]>(initial.conditions.map((c) => ({ ...c, value: Array.isArray(c.value) ? (c.value as unknown as string[]).join(",") : c.value === undefined ? "" : String(c.value) })));
  const [acts, setActs] = useState<Act[]>(initial.actions);
  const L = (he: string, en: string) => (isHe ? he : en);

  const json = useMemo(() => JSON.stringify({
    conditions: conds.filter((c) => c.field).map((c) => {
      if (c.op === "exists" || c.op === "not_exists") return { field: c.field, op: c.op };
      if (c.op === "in") return { field: c.field, op: c.op, value: (c.value ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
      const n = Number(c.value);
      return { field: c.field, op: c.op, value: ["gt", "gte", "lt", "lte"].includes(c.op) && Number.isFinite(n) ? n : c.value ?? "" };
    }),
    actions: acts.map((a) => {
      const out: Record<string, unknown> = { ...a };
      for (const k of ["dueInDays", "priority", "inDays", "delayHours"]) if (out[k] !== undefined && out[k] !== "") out[k] = Number(out[k]); else delete out[k];
      return out;
    }),
  }), [conds, acts]);

  const setAct = (i: number, patch: Partial<Act>) => setActs((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } as Act : x)));
  const newAct = (type: string): Act =>
    type === "message.draft" ? { type, channel: "WHATSAPP", templateKey: templates[0]?.key ?? "welcome" }
    : type === "task.create" ? { type, title: L("משימה חדשה", "New task"), dueInDays: 1, priority: 2 }
    : type === "notify" ? { type, title: L("התראה", "Notification"), level: "info" }
    : type === "customer.tag" ? { type, tag: "vip" }
    : type === "lead.schedule_followup" ? { type, inDays: 2 }
    : type === "approval.request" ? { type, title: L("בקשת אישור", "Approval request") }
    : { type };

  return (
    <div className="space-y-5">
      <input type="hidden" name="definition" value={json} />
      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{labels.conditions}</h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConds((c) => [...c, { field: FIELDS[0], op: "eq", value: "" }])}><Plus size={13} /> {labels.add}</Button></div>
        {conds.length === 0 && <p className="text-xs text-muted">{L("ללא תנאים — האוטומציה תרוץ בכל פעם שהטריגר מתרחש.", "No conditions — runs every time the trigger fires.")}</p>}
        <div className="space-y-2">
          {conds.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:grid-cols-[1.4fr_0.8fr_1fr_auto]">
              <Select aria-label="field" value={c.field} onChange={(e) => setConds((xs) => xs.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} dir="ltr">
                {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
              <Select aria-label="operator" value={c.op} onChange={(e) => setConds((xs) => xs.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))} dir="ltr">
                {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
              {c.op !== "exists" && c.op !== "not_exists" ? (
                <Input aria-label="value" value={c.value ?? ""} onChange={(e) => setConds((xs) => xs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} dir="ltr" placeholder={c.op === "in" ? "a,b,c" : "value"} />
              ) : <span />}
              <Button type="button" size="sm" variant="ghost" aria-label={labels.remove} onClick={() => setConds((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{labels.actions}</h3>
          <Select aria-label={labels.add} className="h-9 w-auto text-xs" value="" onChange={(e) => { if (e.target.value) setActs((xs) => [...xs, newAct(e.target.value)]); }}>
            <option value="">+ {labels.add}…</option>
            <option value="message.draft">{L("טיוטת הודעה (לאישור)", "Message draft (needs approval)")}</option>
            <option value="task.create">{L("יצירת משימה", "Create task")}</option>
            <option value="notify">{L("התראה לבעלים", "Notify owner")}</option>
            <option value="customer.tag">{L("תיוג לקוח", "Tag customer")}</option>
            <option value="lead.schedule_followup">{L("קביעת מעקב ליד", "Schedule lead follow-up")}</option>
            <option value="approval.request">{L("בקשת אישור", "Approval request")}</option>
            <option value="report.weekly">{L("דוח ביצועים", "Performance report")}</option>
          </Select></div>
        <ol className="space-y-2">
          {acts.map((a, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gold" dir="ltr">{i + 1}. {a.type}</span>
                <div className="flex gap-1">
                  {i > 0 && <Button type="button" size="sm" variant="ghost" aria-label="up" onClick={() => setActs((xs) => { const c = [...xs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}><ArrowUp size={13} /></Button>}
                  <Button type="button" size="sm" variant="ghost" aria-label={labels.remove} onClick={() => setActs((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={13} /></Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {a.type === "message.draft" && (<>
                  <div><Label>{L("ערוץ", "Channel")}</Label><Select value={String(a.channel)} onChange={(e) => setAct(i, { channel: e.target.value })}><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></Select></div>
                  <div><Label>{L("תבנית", "Template")}</Label><Select value={String(a.templateKey)} onChange={(e) => setAct(i, { templateKey: e.target.value })}>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select></div>
                  <div><Label>{L("עיכוב (שעות)", "Delay (hours)")}</Label><Input type="number" min={0} value={a.delayHours ?? ""} onChange={(e) => setAct(i, { delayHours: e.target.value })} /></div>
                </>)}
                {(a.type === "task.create" || a.type === "notify" || a.type === "approval.request") && (
                  <div className="sm:col-span-2"><Label>{L("כותרת", "Title")}</Label><Input value={String(a.title ?? "")} onChange={(e) => setAct(i, { title: e.target.value })} /></div>
                )}
                {a.type === "task.create" && (<>
                  <div><Label>{L("יעד (ימים)", "Due (days)")}</Label><Input type="number" min={0} value={a.dueInDays ?? 1} onChange={(e) => setAct(i, { dueInDays: e.target.value })} /></div>
                  <div><Label>{L("עדיפות", "Priority")}</Label><Select value={String(a.priority ?? 2)} onChange={(e) => setAct(i, { priority: e.target.value })}><option value="1">1</option><option value="2">2</option><option value="3">3</option></Select></div>
                </>)}
                {a.type === "notify" && <div><Label>{L("רמה", "Level")}</Label><Select value={String(a.level ?? "info")} onChange={(e) => setAct(i, { level: e.target.value })}><option value="info">info</option><option value="warn">warn</option><option value="success">success</option></Select></div>}
                {a.type === "customer.tag" && <div><Label>{L("תגית", "Tag")}</Label><Input value={String(a.tag ?? "")} onChange={(e) => setAct(i, { tag: e.target.value })} dir="ltr" /></div>}
                {a.type === "lead.schedule_followup" && <div><Label>{L("בעוד (ימים)", "In (days)")}</Label><Input type="number" min={0} value={a.inDays ?? 2} onChange={(e) => setAct(i, { inDays: e.target.value })} /></div>}
              </div>
            </li>
          ))}
        </ol>
        {acts.length === 0 && <p className="text-xs text-danger">{L("נדרשת לפחות פעולה אחת", "At least one action is required")}</p>}
      </section>
    </div>
  );
}
