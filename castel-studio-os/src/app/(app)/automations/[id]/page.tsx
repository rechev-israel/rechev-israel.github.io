import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { TRIGGERS, TRIGGER_KEYS, definitionSchema } from "@/server/automation/definition";
import { DEFAULT_TEMPLATES } from "@/server/comms/templates";
import { deleteAutomationAction, saveAutomationAction } from "@/server/actions/automation";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice, PageHeader, Select } from "@/components/ui";
import { DefinitionEditor } from "@/components/automation/definition-editor";
import { Forbidden } from "@/components/forbidden";

export default async function AutomationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, locale, t, allowed } = await pageGuard("automations.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const { id } = await params;
  const a = id === "new" ? null : await db.automation.findFirst({ where: { id, businessId: user.businessId } });
  if (id !== "new" && !a) notFound();
  const parsed = a ? definitionSchema.safeParse(a.definition) : null;
  const initial = parsed?.success ? parsed.data : { conditions: [], actions: [{ type: "task.create", title: L("משימה חדשה", "New task"), dueInDays: 1, priority: 2 }] };
  const templates = DEFAULT_TEMPLATES.map((tp) => ({ key: tp.key, name: locale === "he" ? tp.name.he : tp.name.en }));
  return (
    <>
      <Link href="/automations" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.nav.automations}</Link>
      <PageHeader title={a ? a.name : L("אוטומציה חדשה", "New automation")} actions={a && !a.key && <InlineAction action={deleteAutomationAction} fields={{ id: a.id }} variant="danger" size="md" confirm={t.common.delete + "?"}><Trash2 size={14} /> {t.common.delete}</InlineAction>} />
      <Notice tone="gold" className="mb-4">{L("פעולות \"טיוטת הודעה\" לעולם לא שולחות לבד: ההודעה נכנסת לתור האישורים במרכז התקשורת, ונשלחת רק אחרי אישורך ורק לנמען עם הסכמה מתאימה.", "\"Message draft\" actions never send by themselves: the message enters the approval queue and is sent only after your approval and only to recipients with suitable consent.")}</Notice>
      <Card className="max-w-4xl">
        <ActionForm action={saveAutomationAction.bind(null, a?.id ?? null)} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>{t.common.name} *</Label><Input name="name" required defaultValue={a?.name} /><FieldError name="name" /></div>
            <div>
              <Label>{L("טריגר", "Trigger")} *</Label>
              <Select name="trigger" defaultValue={a?.trigger ?? "customer.created"}>
                {TRIGGER_KEYS.map((k) => <option key={k} value={k}>{locale === "he" ? TRIGGERS[k].he : TRIGGERS[k].en}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2"><Label>{t.common.description}</Label><Input name="description" defaultValue={a?.description ?? ""} /></div>
            <div><Label>{L("מקסימום ניסיונות", "Max attempts")}</Label><Input name="maxRetries" type="number" min={1} max={5} defaultValue={a?.maxRetries ?? 3} /></div>
          </div>
          <DefinitionEditor initial={initial as never} templates={templates} isHe={locale === "he"} labels={{ conditions: L("תנאים", "Conditions"), actions: L("פעולות", "Actions"), add: t.common.add, remove: t.common.delete }} />
          <FieldError name="definition" />
          {a?.key && <p className="text-xs text-muted">{L("זו אוטומציה מובנית: אפשר לערוך ולהשבית, לא למחוק.", "Built-in workflow: can be edited or deactivated, not deleted.")}</p>}
          {!a && <p className="text-xs text-muted">{L("אוטומציה חדשה נשמרת כבויה. הפעל אותה מהרשימה לאחר בדיקה.", "New automations are saved inactive. Activate from the list after review.")}</p>}
          <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
