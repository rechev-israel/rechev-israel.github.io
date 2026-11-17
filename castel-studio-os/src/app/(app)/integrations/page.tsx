import { Fragment } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, KeyRound, Lock, PlugZap, ShieldCheck, TriangleAlert, Clock } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { getIntegrationOverview } from "@/server/integrations/registry";
import { storedSecretMeta } from "@/server/secrets/store";
import { encryptionAvailable } from "@/server/secrets/crypto";
import { appOrigin } from "@/server/integrations/origin";
import { saveIntegrationAction, testIntegrationAction, removeIntegrationSecretAction } from "@/server/actions/integrations";
import { formatDateTime } from "@/lib/utils";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Input, Label, Notice, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "מרכז חיבורים" };
export const dynamic = "force-dynamic";

const META_MSG: Record<string, [string, string, "success" | "danger" | "warning"]> = {
  connected: ["החיבור ל-Meta הושלם ואומת.", "Meta connected and verified.", "success"],
  check: ["ההרשאה התקבלה — ראו את תוצאת הבדיקה בכרטיס.", "Authorization received — see the test result on the card.", "warning"],
  denied: ["ההרשאה בוטלה בחלון של Facebook.", "Authorization was cancelled in Facebook.", "warning"],
  bad_state: ["בדיקת אבטחה (state) נכשלה. התחילו את החיבור מחדש.", "Security check (state) failed. Start again.", "danger"],
  no_code: ["Facebook לא החזיר קוד הרשאה.", "Facebook returned no authorization code.", "danger"],
  exchange_failed: ["החלפת הקוד לטוקן נכשלה — בדקו App Secret ו-Redirect URI.", "Code exchange failed — check App Secret and Redirect URI.", "danger"],
  missing_app: ["הזינו קודם App ID ו-App Secret.", "Enter App ID and App Secret first.", "warning"],
  no_encryption: ["נדרש SECRETS_ENCRYPTION_KEY כדי לשמור את הטוקן.", "SECRETS_ENCRYPTION_KEY is required to store the token.", "danger"],
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ meta?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("integrations.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const [list, stored, sp] = await Promise.all([getIntegrationOverview(user.businessId), storedSecretMeta(user.businessId), searchParams]);
  const manage = can(user.role, "integrations.manage");
  const enc = encryptionAvailable();
  const origin = appOrigin();
  const STATE = {
    connected: { tone: "success", icon: CheckCircle2, label: L("מחובר · אומת", "Connected · verified") },
    unverified: { tone: "info", icon: CircleDashed, label: L("הוגדר · טרם נבדק", "Configured · not tested") },
    not_configured: { tone: "neutral", icon: KeyRound, label: L("לא מוגדר", "Not configured") },
    error: { tone: "danger", icon: TriangleAlert, label: L("שגיאה", "Error") },
    waiting: { tone: "warning", icon: Clock, label: L("ממתין לפעולה", "Action needed") },
  } as const;
  const counts = list.reduce<Record<string, number>>((a, i) => ((a[i.state] = (a[i.state] ?? 0) + 1), a), {});
  const metaMsg = sp.meta ? META_MSG[sp.meta] : null;
  const ai = list.find((i) => i.provider === "anthropic")!;

  return (
    <>
      <PageHeader
        title={L("מרכז חיבורים", "Integration Center")}
        subtitle={L("כל החיבורים החיצוניים במקום אחד. ״מחובר״ מוצג רק אחרי בדיקה אמיתית מול הספק.", "Every external connection in one place. \"Connected\" only after a real test against the provider.")}
        actions={<ActionForm action={testIntegrationAction} showSuccess><input type="hidden" name="provider" value="__all" /><SubmitButton variant="secondary" pendingLabel={L("בודק…", "Testing…")}><PlugZap size={14} /> {L("בדיקת כל החיבורים", "Test all")}</SubmitButton></ActionForm>}
      />
      {metaMsg && <Notice tone={metaMsg[2]} className="mb-4">{he ? metaMsg[0] : metaMsg[1]}</Notice>}

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(STATE) as (keyof typeof STATE)[]).map((s) => <Badge key={s} tone={STATE[s].tone} className="h-7 px-3">{STATE[s].label}: {counts[s] ?? 0}</Badge>)}
      </div>

      <Card className="mb-4 border-gold/30 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-gold" size={20} />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{L("אבטחת מפתחות", "Credential security")}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5 text-xs text-muted">
              <li>{L("מפתחות אף פעם לא נשלחים חזרה לדפדפן — מוצגות רק 4 הספרות האחרונות.", "Keys are never sent back to the browser — only the last 4 characters are shown.")}</li>
              <li>{L("אפשרות א׳: משתני סביבה ב-Vercel (עדיפות ראשונה). אפשרות ב׳: שמירה כאן בהצפנת AES-256-GCM.", "Option A: Vercel environment variables (take priority). Option B: stored here with AES-256-GCM.")}</li>
              <li>{L("הבדיקות משתמשות בנקודות קצה חינמיות לקריאה בלבד: לא נשלחות הודעות, לא נוצרת מדיה ולא מחויב כסף.", "Tests use free read-only endpoints: no messages, no media generation, no charges.")}</li>
              <li>{L("אל תדביקו מפתחות בצ׳אט, במייל או ב-GitHub.", "Never paste keys in chat, email or GitHub.")}</li>
            </ul>
            {!enc && <Notice tone="warning" className="mt-2">{L("שמירה באפליקציה כבויה: חסר SECRETS_ENCRYPTION_KEY ב-Vercel. עד אז, הוסיפו מפתחות ב-Vercel → Settings → Environment Variables ולאחר מכן Redeploy.", "In-app storage is off: SECRETS_ENCRYPTION_KEY is missing in Vercel. Until then add keys in Vercel → Settings → Environment Variables, then Redeploy.")}</Notice>}
          </div>
        </div>
      </Card>

      {ai.state !== "connected" && <Notice tone="info" className="mb-4">{L("שלב ראשון: חברו את Anthropic Claude כדי להפעיל את מחלקת סוכני ה-AI.", "Step one: connect Anthropic Claude to bring the AI Agents department online.")}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((i) => {
          const S = STATE[i.state];
          const Icon = S.icon;
          const editable = i.fields.filter((f) => !f.envOnly);
          return (
            <Card key={i.provider} id={i.provider} className={`scroll-mt-20 p-4 ${i.provider === "anthropic" ? "lg:col-span-2 border-gold/40" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold">{i.name}</h3>
                  <p className="mt-0.5 text-xs text-muted">{he ? i.purpose.he : i.purpose.en}</p>
                </div>
                <Badge tone={S.tone} className="shrink-0 gap-1"><Icon size={12} /> {S.label}</Badge>
              </div>

              {i.message && i.state !== "not_configured" && i.state !== "unverified" && (
                <Notice tone={i.state === "connected" ? "success" : i.state === "error" ? "danger" : "warning"} className="mt-3">{he ? i.message.he : i.message.en}</Notice>
              )}
              {i.state === "unverified" && <Notice tone="info" className="mt-3">{L("הפרטים הוגדרו או השתנו. לחצו ״בדיקת חיבור״ כדי לאמת מול הספק.", "Credentials set or changed. Click \"Test connection\" to verify with the provider.")}</Notice>}
              {Object.keys(i.info).length > 0 && i.state !== "unverified" && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(i.info).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="min-w-0 truncate" dir="auto">{v}</dd></Fragment>)}
                </dl>
              )}
              {i.lastCheckAt && <p className="mt-2 text-[11px] text-muted">{L("בדיקה אחרונה", "Last test")}: {formatDateTime(i.lastCheckAt, locale)}</p>}

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {i.fields.map((f) => (
                  <span key={f.name} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1" dir="ltr">
                    {f.source ? <CheckCircle2 size={11} className="text-success" /> : <CircleDashed size={11} className="text-muted" />}
                    <code>{f.name}</code>
                    <span className="text-muted">{f.source === "env" ? "· Vercel" : f.source === "app" ? `· ${L("מוצפן", "encrypted")}${f.secret && stored.get(f.name)?.last4 ? ` ••••${stored.get(f.name)!.last4}` : ""}` : f.required ? `· ${L("חסר", "missing")}` : ""}</span>
                  </span>
                ))}
              </div>

              {i.provider === "meta" && <p className="mt-3 text-[11px] text-muted">Redirect URI: <code dir="ltr" className="select-all break-all text-gold">{origin}/api/integrations/meta/callback</code></p>}
              {i.provider === "cali" && <p className="mt-3 text-[11px] text-muted">Webhook URL: <code dir="ltr" className="select-all break-all text-gold">{origin}/api/integrations/cali/webhook</code></p>}

              <details className="group mt-3 rounded-lg border border-border bg-surface-2/50 p-3" open={i.state === "not_configured" && i.provider === "anthropic"}>
                <summary className="cursor-pointer text-sm font-medium text-gold">{L("איך מחברים", "How to connect")}</summary>
                <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-muted">{i.steps.map((s, k) => <li key={k}>{he ? s.he : s.en}</li>)}</ol>
                <p className="mt-2 text-[11px] text-muted">{L("עלות", "Cost")}: {he ? i.cost.he : i.cost.en}</p>
                {i.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold underline-offset-2 hover:underline"><ExternalLink size={11} /> {l.label}</a>)}
                {i.fields.some((f) => f.envOnly) && <p className="mt-2 text-[11px] text-muted">{L("שדה זה נקבע רק ב-Vercel → Settings → Environment Variables.", "This value is set only in Vercel → Settings → Environment Variables.")}</p>}
              </details>

              {manage && editable.length > 0 && (
              <details className="mt-2 rounded-lg border border-border bg-surface-2/50 p-3" open={i.state !== "connected"}>
                <summary className="cursor-pointer text-sm font-medium text-gold">{i.state === "connected" ? L("עדכון מפתחות", "Update credentials") : L("הזנת מפתחות", "Enter credentials")}</summary>
                {!enc && <p className="mt-2 text-xs text-muted">{L("זמין אחרי הגדרת SECRETS_ENCRYPTION_KEY ב-Vercel. עד אז — הוסיפו את המשתנים ב-Vercel.", "Available once SECRETS_ENCRYPTION_KEY is set in Vercel. Until then, add the variables in Vercel.")}</p>}

                {manage && enc && editable.length > 0 && (
                  <ActionForm action={saveIntegrationAction} className="mt-3 space-y-2" resetOnSuccess>
                    <input type="hidden" name="provider" value={i.provider} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {editable.map((f) => (
                        <div key={f.name} className="min-w-0">
                          <Label htmlFor={`${i.provider}-${f.name}`}>{he ? f.label.he : f.label.en}{f.required ? " *" : ""}</Label>
                          <Input id={`${i.provider}-${f.name}`} name={f.name} type={f.secret ? "password" : "text"} dir="ltr" autoComplete="off" spellCheck={false} autoCapitalize="off"
                            placeholder={f.source === "env" ? L("מוגדר ב-Vercel (עדיפות)", "Set in Vercel (priority)") : f.source === "app" ? (f.secret ? L("שמור — השאירו ריק כדי לא לשנות", "Saved — leave empty to keep") : f.value) : f.placeholder} disabled={f.source === "env"} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted"><Lock size={11} /> {L("נשלח בחיבור מוצפן ונשמר מוצפן. לא יוצג שוב.", "Sent over HTTPS and stored encrypted. Never shown again.")}</div>
                    <SubmitButton size="sm" pendingLabel={L("שומר ובודק…", "Saving & testing…")}>{L("שמירה ובדיקה", "Save & test")}</SubmitButton>
                  </ActionForm>
                )}
                {manage && editable.filter((f) => f.source === "app").map((f) => (
                  <ActionForm key={f.name} action={removeIntegrationSecretAction} className="mt-2 inline-block me-2" showSuccess={false}>
                    <input type="hidden" name="provider" value={i.provider} /><input type="hidden" name="name" value={f.name} />
                    <SubmitButton size="sm" variant="ghost">{L("מחיקת", "Remove")} {f.name}</SubmitButton>
                  </ActionForm>
                ))}
              </details>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <ActionForm action={testIntegrationAction}>
                  <input type="hidden" name="provider" value={i.provider} />
                  <SubmitButton size="sm" variant="secondary" pendingLabel={L("בודק…", "Testing…")}><PlugZap size={13} /> {L("בדיקת חיבור", "Test connection")}</SubmitButton>
                </ActionForm>
                {i.provider === "meta" && manage && i.missing.length === 0 && (
                  <a href="/api/integrations/meta/connect" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1877F2] px-3 text-sm font-medium text-white hover:opacity-90">{i.metaConnected ? L("התחברות מחדש עם Facebook", "Reconnect with Facebook") : L("התחברות עם Facebook", "Connect with Facebook")}</a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
