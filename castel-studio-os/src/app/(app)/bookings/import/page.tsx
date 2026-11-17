import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { importBookingCsvAction } from "@/server/actions/bookings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { user, t, locale, allowed } = await pageGuard("bookings.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const [logs, synced] = await Promise.all([
    db.syncLog.findMany({ where: { businessId: user.businessId, source: "cali" }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.appointment.count({ where: { businessId: user.businessId, source: "cali" } }),
  ]);
  const webhookReady = Boolean(process.env.CALI_WEBHOOK_SECRET?.trim());
  return (
    <>
      <PageHeader title={L("סנכרון עם אפליקציית Cali", "Cali booking app sync")} subtitle={L(`${synced} תורים מסונכרנים מ-Cali`, `${synced} appointments synced from Cali`)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Badge tone={webhookReady ? (logs.some((l) => l.channel === "webhook") ? "success" : "info") : "warning"}>{webhookReady ? L("נקודת קליטה פעילה", "Endpoint active") : L("ממתין לגישה מהספק", "Waiting for vendor access")}</Badge>}>{L("סנכרון חי (Webhook)", "Live sync (webhook)")}</CardTitle>
          <p className="text-sm text-muted">{L("לאפליקציית Cali אין API ציבורי. כדי לקבל תורים, ביטולים ולקוחות בזמן אמת, ספק Cali צריך לשלוח אירועים חתומים לכתובת הבאה. נשלחת אליו בקשה עם המפרט המלא (CALI_INTEGRATION.md).", "Cali has no public API. For live appointments, cancellations and customers, the Cali vendor must push signed events to this address. Send them the spec (CALI_INTEGRATION.md).")}</p>
          <code dir="ltr" className="mt-3 block break-all rounded-lg bg-surface-2 p-3 text-xs text-gold">POST https://castel-studio-delta.vercel.app/api/integrations/cali/webhook</code>
          {!webhookReady && <Notice tone="neutral" className="mt-3">{L("יופעל אחרי הגדרת CALI_WEBHOOK_SECRET ב-Vercel ומסירתו לספק בערוץ מאובטח.", "Activates after CALI_WEBHOOK_SECRET is set in Vercel and shared with the vendor over a secure channel.")}</Notice>}
          <a href={process.env.EXTERNAL_BOOKING_URL || "https://cali-b5f0e.web.app/"} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm", "mt-3")}>{t.external.open} ↗</a>
        </Card>
        <Card>
          <CardTitle>{L("ייבוא קובץ (CSV) — ללא כפילויות", "File import (CSV) — no duplicates")}</CardTitle>
          <p className="mb-3 text-sm text-muted">{L("אם Cali מאפשרת ייצוא דוח תורים, העלו אותו כאן. ייבוא חוזר של אותו קובץ מעדכן תורים קיימים (סטטוס, ביטולים, מחיר) ולא יוצר כפולים. לקוחות מותאמים לפי מזהה ואז לפי טלפון.", "If Cali can export an appointments report, upload it here. Re-importing the same file updates existing appointments (status, cancellations, price) and never duplicates. Customers are matched by id, then phone.")}</p>
          <ActionForm action={importBookingCsvAction} className="space-y-3">
            <div><Label>{t.external.file}</Label><Input type="file" name="file" accept=".csv,text/csv" required className="pt-2" /></div>
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] text-muted" dir="ltr">{`id,date,time,name,phone,service,price,status\nA123,17/11/2026,10:30,Daniel Levi,050-1234567,תספורת גבר,100,completed\nA124,18/11/2026,12:00,Avi Cohen,052-7654321,תספורת + זקן,140,cancelled`}</pre>
            <p className="text-[11px] text-muted">{L("עמודות נתמכות גם בעברית: מזהה, תאריך, שעה, שם, טלפון, שירות, מחיר, סטטוס, משך, ספר.", "Hebrew headers are also supported: מזהה, תאריך, שעה, שם, טלפון, שירות, מחיר, סטטוס, משך, ספר.")}</p>
            <SubmitButton>{t.external.importNow}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <Card className="mt-4">
        <CardTitle>{L("היסטוריית סנכרון", "Sync history")}</CardTitle>
        {logs.length ? (
          <Table>
            <thead><tr><Th>{t.audit.when}</Th><Th>{L("ערוץ", "Channel")}</Th><Th>{L("התקבלו", "Received")}</Th><Th>{L("חדשים", "New")}</Th><Th>{L("עודכנו", "Updated")}</Th><Th>{L("ללא שינוי", "Unchanged")}</Th><Th>{L("שגיאות", "Errors")}</Th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id}><Td className="text-xs text-muted">{formatDateTime(l.createdAt, locale)}</Td><Td><Badge>{l.channel}</Badge></Td><Td>{l.received}</Td><Td>{l.created}</Td><Td>{l.updated}</Td><Td>{l.unchanged}</Td><Td className={l.failed ? "text-danger" : ""}>{l.failed}</Td></tr>
            ))}</tbody>
          </Table>
        ) : <EmptyState title={t.common.empty} />}
      </Card>
    </>
  );
}
