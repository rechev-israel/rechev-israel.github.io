import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { twinAllows } from "@/server/ai/twin";
import { aiConfigured } from "@/server/ai/provider";
import { providerFor } from "@/server/creative/providers";
import { approveKnowledgeAction, askTwinAction, deleteKnowledgeAction, revokeTwinConsentAction, saveKnowledgeAction, saveTwinConsentAction, twinMediaAction, twinScriptAction } from "@/server/actions/twin";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { ResultForm } from "@/components/result-form";
import { Badge, Button, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";
import { secret } from "@/server/secrets/store";

export const metadata = { title: "Digital Twin" };
export const dynamic = "force-dynamic";

export default async function TwinPage() {
  const { user, locale, t, allowed } = await pageGuard("marketing.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const [profile, knowledge] = await Promise.all([
    db.twinProfile.findUnique({ where: { businessId: user.businessId } }),
    db.knowledgeItem.findMany({ where: { businessId: user.businessId }, orderBy: { updatedAt: "desc" } }),
  ]);
  const owner = can(user.role, "approvals.decide");
  const edit = can(user.role, "marketing.edit");
  const chat = twinAllows(profile, "chat"), voice = twinAllows(profile, "voice"), avatar = twinAllows(profile, "avatar");
  const consentText = L(
    "אני, בעל/ת CASTEL STUDIO, מאשר/ת במפורש יצירה ושימוש בעוזר AI המייצג אותי, בהיקף ההרשאות שסימנתי בלבד. ידוע לי ש: (1) העוזר יציג את עצמו תמיד כ-AI; (2) הוא ישתמש רק במידע שאישרתי; (3) קול ודמות שלי ישמשו רק מחומרי מקור שסיפקתי, ורק לתוכן שאאשר לפני פרסום; (4) אני רשאי/ת לבטל הסכמה זו בכל עת, ואז כל יכולות התאום ייעצרו מיד.",
    "I, the owner of CASTEL STUDIO, explicitly authorise creating and using an AI assistant that represents me, limited to the scopes I selected. I understand that: (1) it always identifies itself as AI; (2) it uses only knowledge I approved; (3) my voice and likeness are used only from source media I supplied and only for content I approve before publishing; (4) I can revoke this consent at any time, which immediately stops all twin capabilities.",
  );
  return (
    <>
      <PageHeader title={t.nav.twin} subtitle={L("עוזר AI שמייצג את הבעלים — רק בהסכמה מפורשת, רק עם ידע מאושר, ותמיד עם אישור לפני פרסום", "An AI assistant that represents the owner — explicit consent only, approved knowledge only, approval before publishing")} actions={<Badge tone={profile?.consentGiven && !profile.revokedAt ? "success" : "warning"} className="h-8 px-3">{profile?.consentGiven && !profile.revokedAt ? L("הסכמה פעילה", "Consent active") : L("אין הסכמה — התאום כבוי", "No consent — twin off")}</Badge>} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>{L("1. הסכמה מפורשת", "1. Explicit consent")}</CardTitle>
          {profile?.consentGiven && !profile.revokedAt ? (
            <div className="space-y-2 text-sm">
              <p>{L("ניתנה ע״י", "Given by")} <b>{profile.ownerName}</b> · {formatDateTime(profile.consentAt, locale)}</p>
              <div className="flex flex-wrap gap-1">{profile.consentScopes.map((s) => <Badge key={s} tone="gold">{s === "chat" ? L("שיחה וטקסט", "Chat & text") : s === "voice" ? L("קול", "Voice") : L("דמות (אווטאר)", "Likeness (avatar)")}</Badge>)}</div>
              {owner && <InlineAction action={revokeTwinConsentAction} variant="danger" confirm={L("לבטל את ההסכמה? כל יכולות התאום ייעצרו.", "Revoke consent? All twin capabilities stop.")}>{L("ביטול הסכמה", "Revoke consent")}</InlineAction>}
            </div>
          ) : owner ? (
            <ActionForm action={saveTwinConsentAction} className="space-y-3">
              <input type="hidden" name="consentText" value={consentText} />
              <div><Label>{L("שם הבעלים", "Owner name")} *</Label><Input name="ownerName" required defaultValue={profile?.ownerName ?? user.name} /></div>
              <div><Label>{L("סגנון אישי (איך אתה מדבר)", "Personal style (how you speak)")}</Label><Textarea name="persona" rows={2} defaultValue={profile?.persona ?? ""} /></div>
              <fieldset className="space-y-1 text-sm">
                <legend className="mb-1 text-xs text-muted">{L("הרשאות", "Scopes")}</legend>
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="chat" defaultChecked className="h-4 w-4 accent-[var(--gold)]" /> {L("שיחה וטקסט (תשובות, תסריטים)", "Chat & text (answers, scripts)")}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="voice" className="h-4 w-4 accent-[var(--gold)]" /> {L("קול (קול שיצרתי ב-ElevenLabs מדגימות שלי)", "Voice (a voice I created in ElevenLabs from my samples)")}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="avatar" className="h-4 w-4 accent-[var(--gold)]" /> {L("דמות — וידאו אווטאר מתמונה שסיפקתי", "Likeness — avatar video from a photo I supplied")}</label>
              </fieldset>
              <div><Label>{L("קישור לתמונת פורטרט (https, רק להרשאת דמות)", "Portrait URL (https, avatar scope only)")}</Label><Input name="portraitUrl" type="url" dir="ltr" /></div>
              <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">{consentText}</p>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-[var(--gold)]" /> {L("קראתי ואני מאשר/ת", "I have read and agree")}</label>
              <SubmitButton>{L("מתן הסכמה", "Give consent")}</SubmitButton>
            </ActionForm>
          ) : <Notice tone="neutral">{L("רק הבעלים יכול לתת הסכמה.", "Only the owner can give consent.")}</Notice>}
        </Card>

        <Card>
          <CardTitle>{L("2. בסיס ידע מאושר", "2. Approved knowledge base")}</CardTitle>
          <p className="mb-3 text-xs text-muted">{L("התאום עונה רק מפריטים שהבעלים אישר. כל עריכה מחזירה פריט לסטטוס ״לא מאושר״.", "The twin answers only from owner-approved items. Any edit returns an item to \"not approved\".")}</p>
          {edit && (
            <ActionForm action={saveKnowledgeAction.bind(null, null)} resetOnSuccess className="mb-3 space-y-2">
              <Input name="title" placeholder={L("נושא (למשל: מדיניות ביטולים)", "Topic (e.g. cancellation policy)")} required />
              <Textarea name="body" rows={3} placeholder={L("התוכן המדויק", "Exact content")} required /><FieldError name="body" />
              <SubmitButton size="sm">{t.common.add}</SubmitButton>
            </ActionForm>
          )}
          {knowledge.length === 0 ? <EmptyState title={t.common.empty} /> : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {knowledge.map((k) => (
                <li key={k.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2"><p className="font-medium">{k.title}</p><Badge tone={k.approved ? "success" : "warning"}>{k.approved ? L("מאושר", "Approved") : L("ממתין לאישור", "Pending")}</Badge></div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{k.body}</p>
                  <div className="mt-2 flex gap-1">
                    {owner && <InlineAction action={approveKnowledgeAction} fields={{ id: k.id, approved: k.approved ? "0" : "1" }} variant={k.approved ? "ghost" : "outline"}>{k.approved ? L("ביטול אישור", "Unapprove") : L("אישור", "Approve")}</InlineAction>}
                    {edit && <InlineAction action={deleteKnowledgeAction} fields={{ id: k.id }} confirm={t.common.delete + "?"}>✕</InlineAction>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Badge tone={chat && aiConfigured() ? "success" : "warning"}>{chat ? (aiConfigured() ? L("פעיל", "Active") : "ANTHROPIC_API_KEY") : L("נדרשת הסכמה", "Consent needed")}</Badge>}>{L("3. שיחה עם התאום (בדיקה)", "3. Talk to the twin (test)")}</CardTitle>
          <ResultForm action={askTwinAction} className="flex gap-2" copyLabel={L("העתקה", "Copy")}>
            <Input name="question" placeholder={L("למשל: כמה עולה הקורס הקבוצתי?", "e.g. How much is the group course?")} required disabled={!chat} />
            <Button type="submit" disabled={!chat || !aiConfigured()}>{L("שאלה", "Ask")}</Button>
          </ResultForm>
        </Card>

        <Card>
          <CardTitle>{L("4. תסריט, קול ווידאו אווטאר", "4. Script, voice & avatar video")}</CardTitle>
          <ResultForm action={twinScriptAction} className="flex gap-2" copyLabel={L("העתקה", "Copy")}>
            <Input name="topic" placeholder={L("נושא: מחזור חדש לקורס בינואר", "Topic: new course cohort in January")} required disabled={!chat || !edit} />
            <Button type="submit" variant="outline" disabled={!chat || !aiConfigured() || !edit}>{L("כתיבת תסריט", "Write script")}</Button>
          </ResultForm>
          {owner && (
            <ResultForm action={twinMediaAction} className="mt-4 space-y-2" copyLabel={L("העתקה", "Copy")}>
              <Textarea name="script" rows={4} placeholder={L("הדביקו כאן את התסריט המאושר", "Paste the approved script")} required />
              <div className="flex flex-wrap items-center gap-2">
                <Select name="kind" className="w-auto"><option value="voice" disabled={!voice}>{L("קריינות בקול שלי", "Voice-over in my voice")}{voice ? "" : ` — ${L("ללא הסכמה", "no consent")}`}</option><option value="avatar" disabled={!avatar}>{L("וידאו אווטאר", "Avatar video")}{avatar ? "" : ` — ${L("ללא הסכמה", "no consent")}`}</option></Select>
                <Button type="submit" disabled={!voice && !avatar}>{L("יצירה", "Generate")}</Button>
              </div>
              <p className="text-[11px] text-muted">{L("ספקים", "Providers")}: {L("קול", "voice")} — {secret("ELEVENLABS_TWIN_VOICE_ID") && providerFor("voiceover") ? "✓ ElevenLabs" : "ELEVENLABS_API_KEY + ELEVENLABS_TWIN_VOICE_ID"} · {L("אווטאר", "avatar")} — {providerFor("avatar") ? "✓ Replicate" : "REPLICATE_API_TOKEN + REPLICATE_MODEL_AVATAR"}. {L("התוצרים נשמרים בספריית הנכסים ומחייבים אישור לפני שימוש.", "Outputs go to the asset library and require approval before use.")}</p>
            </ResultForm>
          )}
        </Card>
      </div>
    </>
  );
}
