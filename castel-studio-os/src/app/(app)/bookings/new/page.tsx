import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/dates";
import { fullName, toNumber } from "@/lib/utils";
import { createAppointmentAction } from "@/server/actions/bookings";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ customerId?: string; startsAt?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("bookings.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const sp = await searchParams;
  const [customers, services, staff] = await Promise.all([
    db.customer.findMany({ where: { businessId: user.businessId, archivedAt: null }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, phone: true }, take: 1000 }),
    db.service.findMany({ where: { businessId: user.businessId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ where: { businessId: user.businessId, isActive: true, role: { in: ["OWNER", "MANAGER", "BARBER"] } }, select: { id: true, name: true } }),
  ]);
  const next = new Date(Math.ceil(Date.now() / 1800_000) * 1800_000);
  return (
    <>
      <PageHeader title={t.bookings.new} />
      <Card className="max-w-2xl">
        <ActionForm action={createAppointmentAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{t.bookings.customer}</Label>
            <Select name="customerId" defaultValue={sp.customerId ?? ""}>
              <option value="">{t.bookings.walkIn}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{fullName(c)}{c.phone ? ` · ${c.phone}` : ""}</option>)}
            </Select>
            <FieldError name="customerId" />
          </div>
          <div>
            <Label>{t.bookings.service}</Label>
            <Select name="serviceId">
              <option value="">—</option>
              {services.map((s) => <option key={s.id} value={s.id}>{locale === "he" ? s.nameHe : s.nameEn} · {s.durationMin}′ · ₪{toNumber(s.price)}</option>)}
            </Select>
          </div>
          <div>
            <Label>{t.bookings.staff}</Label>
            <Select name="staffId"><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </div>
          <div>
            <Label>{t.bookings.startsAt} *</Label>
            <Input type="datetime-local" name="startsAt" required defaultValue={sp.startsAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(sp.startsAt) ? sp.startsAt : toLocalInput(next)} step={300} />
            <FieldError name="startsAt" />
          </div>
          <div>
            <Label>{t.bookings.duration}</Label>
            <Input type="number" name="durationMin" min={5} max={600} placeholder="auto" />
          </div>
          <div>
            <Label>{t.common.price} (₪)</Label>
            <Input type="number" name="price" min={0} step="1" placeholder="auto" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="allowOverlap" className="accent-[var(--gold)]" /> {t.bookings.overlap} — OK</label>
          </div>
          <div className="md:col-span-2"><Label>{t.common.notes}</Label><Textarea name="notes" /></div>
          <div className="md:col-span-2 flex justify-end"><SubmitButton>{t.common.create}</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
