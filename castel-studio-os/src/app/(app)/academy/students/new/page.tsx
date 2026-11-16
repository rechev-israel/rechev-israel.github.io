import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { createStudentAction } from "@/server/actions/academy";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ cohortId?: string }> }) {
  const { user, t, allowed } = await pageGuard("academy.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { cohortId } = await searchParams;
  const cohort = cohortId ? await db.cohort.findFirst({ where: { id: cohortId, course: { businessId: user.businessId } } }) : null;
  return (
    <>
      <PageHeader title={t.academy.newStudent} subtitle={cohort ? `${t.academy.enroll}: ${cohort.name}` : undefined} />
      <Card className="max-w-2xl">
        <ActionForm action={createStudentAction} className="grid gap-4 md:grid-cols-2">
          {cohort && <input type="hidden" name="cohortId" value={cohort.id} />}
          <div><Label>{t.common.firstName} *</Label><Input name="firstName" required /><FieldError name="firstName" /></div>
          <div><Label>{t.common.lastName}</Label><Input name="lastName" /></div>
          <div><Label>{t.common.phone}</Label><Input name="phone" type="tel" dir="ltr" /><FieldError name="phone" /></div>
          <div><Label>{t.common.email}</Label><Input name="email" type="email" dir="ltr" /><FieldError name="email" /></div>
          <div className="md:col-span-2"><Label>{t.academy.experience}</Label><Textarea name="experience" /></div>
          <div className="md:col-span-2"><Label>{t.academy.goals}</Label><Textarea name="goals" /></div>
          <div><Label>{t.common.status}</Label><Select name="status" defaultValue="ENROLLED">{(["LEAD", "ENROLLED", "ACTIVE"] as const).map((s) => <option key={s} value={s}>{t.studentStatus[s]}</option>)}</Select></div>
          <div className="flex items-end justify-end"><SubmitButton>{t.common.create}</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
