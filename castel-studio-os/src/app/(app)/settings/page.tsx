import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { changePasswordAction } from "@/server/actions/auth";
import { createUserAction, purgeDemoDataAction, updateBusinessAction, updateUserAction } from "@/server/actions/system";
import { demoDataCounts } from "@/server/services/bookings";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { AutoSubmitSelect } from "@/components/academy/auto-submit-select";
import { Badge, Card, CardTitle, Input, Label, PageHeader, Select, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Settings" };
const ROLES = ["OWNER", "MANAGER", "BARBER", "INSTRUCTOR", "MARKETING", "ACCOUNTANT", "VIEWER"] as const;

export default async function SettingsPage() {
  const { user, t, locale } = await pageGuard();
  const business = await db.business.findUniqueOrThrow({ where: { id: user.businessId } });
  const manageUsers = can(user.role, "settings.users");
  const users = manageUsers ? await db.user.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "asc" } }) : [];
  const demo = manageUsers ? await demoDataCounts(user.businessId) : null;
  const demoTotal = demo ? Object.values(demo).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{t.settings.business}</CardTitle>
          <ActionForm action={updateBusinessAction} className="space-y-3">
            <div><Label>{t.common.name}</Label><Input name="name" defaultValue={business.name} disabled={!can(user.role, "settings.business")} /></div>
            <div><Label>{t.settings.city}</Label><Input name="city" defaultValue={business.city} disabled={!can(user.role, "settings.business")} /></div>
            <div><Label>{t.settings.instagram}</Label><Input name="instagram" defaultValue={business.instagram ?? ""} dir="ltr" disabled={!can(user.role, "settings.business")} /><FieldError name="instagram" /></div>
            <p className="text-xs text-muted">{t.settings.currency}: ILS (₪) · {business.timezone}</p>
            {can(user.role, "settings.business") && <SubmitButton>{t.common.save}</SubmitButton>}
          </ActionForm>
        </Card>
        <Card>
          <CardTitle>{t.settings.changePassword}</CardTitle>
          <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
            <div><Label>{t.settings.currentPassword}</Label><Input name="current" type="password" autoComplete="current-password" required dir="ltr" /><FieldError name="current" /></div>
            <div><Label>{t.settings.newPassword}</Label><Input name="next" type="password" autoComplete="new-password" required minLength={10} dir="ltr" /><FieldError name="next" /><p className="mt-1 text-[11px] text-muted">{t.password.tooShort} · {t.password.weak}</p></div>
            <SubmitButton>{t.common.save}</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {manageUsers && (
        <Card className="mt-4">
          <CardTitle>{t.settings.users}</CardTitle>
          <Table>
            <thead><tr><Th>{t.common.name}</Th><Th>{t.common.email}</Th><Th>{t.settings.role}</Th><Th>{t.common.status}</Th><Th>Last login</Th><Th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium">{u.name}{u.id === user.id && <Badge tone="gold" className="ms-2">you</Badge>}</Td>
                  <Td dir="ltr" className="text-muted">{u.email}</Td>
                  <Td className="w-40"><AutoSubmitSelect action={updateUserAction} fields={{ id: u.id }} name="role" value={u.role} label={t.settings.role} options={ROLES.map((r) => ({ value: r, label: t.roles[r] }))} /></Td>
                  <Td><Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? t.settings.active : "—"}</Badge></Td>
                  <Td className="text-xs text-muted">{formatDateTime(u.lastLoginAt, locale)}</Td>
                  <Td>{u.id !== user.id && <InlineAction action={updateUserAction} fields={{ id: u.id, toggleActive: "1" }} confirm="?">{u.isActive ? t.settings.deactivate : t.settings.activate}</InlineAction>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ActionForm action={createUserAction} resetOnSuccess className="mt-4 grid items-end gap-2 rounded-xl border border-dashed border-border p-3 md:grid-cols-5">
            <div><Label>{t.common.name}</Label><Input name="name" required /><FieldError name="name" /></div>
            <div><Label>{t.common.email}</Label><Input name="email" type="email" required dir="ltr" /><FieldError name="email" /></div>
            <div><Label>{t.settings.role}</Label><Select name="role" defaultValue="BARBER">{ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</Select></div>
            <div><Label>{t.auth.password}</Label><Input name="password" type="password" required minLength={10} dir="ltr" autoComplete="new-password" /><FieldError name="password" /></div>
            <SubmitButton>{t.settings.newUser}</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {demo && (
        <Card className="mt-4 border-warning/30">
          <CardTitle>{locale === "he" ? "נתוני הדגמה" : "Demo data"}</CardTitle>
          {demoTotal === 0 ? <p className="text-sm text-success">{locale === "he" ? "✓ אין נתוני הדגמה במערכת. כל הנתונים אמיתיים." : "✓ No demo data. Everything is real."}</p> : (
            <>
              <p className="text-sm text-muted">{locale === "he" ? `נמצאו נתוני הדגמה (מסומנים [DEMO]): ${demo.appointments} תורים, ${demo.customers} לקוחות, ${demo.transactions} תנועות כספיות, ${demo.services} שירותים, ${demo.leads} לידים. הם משפיעים על הדוחות וההכנסות. נתונים אמיתיים לא יימחקו.` : `Demo records found: ${demo.appointments} appointments, ${demo.customers} customers, ${demo.transactions} transactions, ${demo.services} services, ${demo.leads} leads. Real data is never touched.`}</p>
              <ActionForm action={purgeDemoDataAction} className="mt-3 flex flex-wrap items-end gap-2">
                <div><Label>{locale === "he" ? "להקליד DEMO לאישור" : "Type DEMO to confirm"}</Label><Input name="confirm" dir="ltr" autoComplete="off" className="w-40" /></div>
                <SubmitButton variant="danger">{locale === "he" ? "מחיקת נתוני ההדגמה" : "Delete demo data"}</SubmitButton>
              </ActionForm>
            </>
          )}
        </Card>
      )}
    </>
  );
}
