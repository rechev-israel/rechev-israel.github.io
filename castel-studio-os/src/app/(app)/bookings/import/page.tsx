import { pageGuard } from "@/server/auth/guard";
import { importBookingCsvAction } from "@/server/actions/bookings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice, PageHeader, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function ImportPage() {
  const { t, allowed } = await pageGuard("bookings.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  return (
    <>
      <PageHeader title={t.bookings.import} subtitle={t.external.title} />
      <Card className="max-w-2xl space-y-4">
        <Notice tone="warning">{t.external.body}</Notice>
        <a href={process.env.EXTERNAL_BOOKING_URL || "https://cali-b5f0e.web.app/"} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>{t.external.open} ↗</a>
        <ActionForm action={importBookingCsvAction} className="space-y-3">
          <div>
            <Label>{t.external.file}</Label>
            <Input type="file" name="file" accept=".csv,text/csv" required className="pt-2" />
            <p className="mt-1 text-[11px] text-muted" dir="ltr">{t.external.csvHint}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] text-muted" dir="ltr">{`date,time,name,phone,service,price,status\n17/11/2026,10:30,Daniel Levi,050-1234567,Men's haircut,100,completed`}</pre>
          </div>
          <SubmitButton>{t.external.importNow}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
