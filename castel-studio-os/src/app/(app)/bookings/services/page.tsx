import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { saveServiceAction } from "@/server/actions/bookings";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Card, CardTitle, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";
import type { Service } from "@prisma/client";
import type { Dictionary } from "@/i18n/he";

function ServiceForm({ s, t, disabled }: { s?: Service; t: Dictionary; disabled: boolean }) {
  return (
    <ActionForm action={saveServiceAction.bind(null, s?.id ?? null)} resetOnSuccess={!s} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_100px_100px_auto_auto]">
      <div><Label>{t.bookings.nameHe}</Label><Input name="nameHe" defaultValue={s?.nameHe} required disabled={disabled} /><FieldError name="nameHe" /></div>
      <div><Label>{t.bookings.nameEn}</Label><Input name="nameEn" defaultValue={s?.nameEn} required disabled={disabled} dir="ltr" /><FieldError name="nameEn" /></div>
      <div><Label>{t.bookings.duration}</Label><Input name="durationMin" type="number" min={5} defaultValue={s?.durationMin ?? 30} disabled={disabled} /></div>
      <div><Label>{t.common.price} ₪</Label><Input name="price" type="number" min={0} defaultValue={s ? toNumber(s.price) : ""} required disabled={disabled} /><FieldError name="price" /></div>
      <label className="flex h-10 items-center gap-2 text-xs text-muted"><input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} disabled={disabled} className="accent-[var(--gold)]" /> {t.bookings.active}</label>
      {!disabled && <SubmitButton variant={s ? "secondary" : "primary"}>{s ? t.common.save : t.common.add}</SubmitButton>}
    </ActionForm>
  );
}

export default async function ServicesPage() {
  const { user, t, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const services = await db.service.findMany({ where: { businessId: user.businessId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const edit = can(user.role, "services.edit");
  return (
    <>
      <PageHeader title={t.bookings.services} />
      {edit && (
        <Card className="mb-4">
          <CardTitle>{t.bookings.newService}</CardTitle>
          <ServiceForm t={t} disabled={false} />
        </Card>
      )}
      <Card className="space-y-4">
        {services.length ? services.map((s) => <div key={s.id} className="border-b border-border pb-4 last:border-0 last:pb-0"><ServiceForm s={s} t={t} disabled={!edit} /></div>) : <EmptyState title={t.common.empty} />}
      </Card>
    </>
  );
}
