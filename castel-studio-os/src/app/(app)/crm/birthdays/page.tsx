import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { canMarketTo, upcomingBirthday } from "@/domain/crm";
import { formatDate, fullName } from "@/lib/utils";
import { draftBirthdayCampaignAction } from "@/server/actions/crm";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Label, Notice, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function BirthdaysPage() {
  const { user, t, locale, allowed } = await pageGuard("crm.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const all = await db.customer.findMany({ where: { businessId: user.businessId, archivedAt: null, birthday: { not: null } } });
  const rows = all
    .map((c) => ({ c, days: upcomingBirthday(c.birthday, new Date(), 14) }))
    .filter((r) => r.days !== null)
    .sort((a, b) => a.days! - b.days!);
  const defaultMsg = locale === "he"
    ? "מזל טוב מ-CASTEL STUDIO! 🎉 לכבוד יום ההולדת מחכה לך הטבה מיוחדת בתור הבא. להסרה השיבו \"הסר\"."
    : "Happy birthday from CASTEL STUDIO! 🎉 A special gift awaits on your next visit. Reply STOP to opt out.";
  return (
    <>
      <PageHeader title={t.crm.birthdayCampaign} subtitle={t.crm.birthdayHint} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {rows.length ? (
            <Table>
              <thead><tr><Th>{t.common.name}</Th><Th>{t.crm.birthday}</Th><Th>WhatsApp</Th><Th>SMS</Th><Th>{t.common.email}</Th></tr></thead>
              <tbody>
                {rows.map(({ c, days }) => (
                  <tr key={c.id}>
                    <Td><Link className="hover:text-gold" href={`/crm/${c.id}`}>{fullName(c)}</Link></Td>
                    <Td className="text-muted">{formatDate(c.birthday, locale, { timeZone: "UTC", year: undefined })} <Badge tone="gold">+{days}</Badge></Td>
                    {(["WHATSAPP", "SMS", "EMAIL"] as const).map((ch) => (
                      <Td key={ch}>{canMarketTo(c, ch) ? <Badge tone="success">✓</Badge> : <Badge>—</Badge>}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title={t.common.empty} />}
        </Card>
        <Card>
          <CardTitle>{t.crm.draftMessage}</CardTitle>
          <Notice tone="gold" className="mb-4">{t.ai.approvalNote} {t.crm.consentNote}</Notice>
          <ActionForm action={draftBirthdayCampaignAction} className="space-y-3">
            <div><Label>{t.crm.channel}</Label><Select name="channel"><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">{t.common.email}</option></Select></div>
            <div><Label>{t.crm.summary}</Label><Textarea name="body" defaultValue={defaultMsg} rows={5} /><FieldError name="body" /></div>
            <SubmitButton className="w-full">{t.crm.draftMessage}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
