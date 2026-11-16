import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatILS } from "@/lib/utils";
import { toLocalInput } from "@/lib/dates";
import { createCohortAction } from "@/server/actions/academy";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice, PageHeader, Select } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function NewCohortPage() {
  const { user, t, locale, allowed } = await pageGuard("academy.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const [courses, instructors] = await Promise.all([
    db.course.findMany({ where: { businessId: user.businessId, isActive: true }, orderBy: { price: "asc" } }),
    db.user.findMany({ where: { businessId: user.businessId, isActive: true, role: { in: ["OWNER", "MANAGER", "INSTRUCTOR"] } }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title={t.academy.newCohort} />
      <Card className="max-w-2xl">
        <ActionForm action={createCohortAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{t.academy.courses} *</Label>
            <Select name="courseId" required>
              {courses.map((c) => <option key={c.id} value={c.id}>{locale === "he" ? c.nameHe : c.nameEn} · {formatILS(c.price, locale)}</option>)}
            </Select>
          </div>
          <div className="md:col-span-2"><Label>{t.common.name} *</Label><Input name="name" required placeholder={locale === "he" ? "מחזור ינואר 2027" : "January 2027 cohort"} /><FieldError name="name" /></div>
          <div><Label>{t.academy.startDate} *</Label><Input type="date" name="startDate" required defaultValue={toLocalInput(new Date(), false)} /><FieldError name="startDate" /></div>
          <div><Label>{t.academy.time} *</Label><Input type="time" name="time" required defaultValue="18:00" /><FieldError name="time" /></div>
          <fieldset className="md:col-span-2">
            <Label>{t.academy.weekdays} *</Label>
            <div className="flex flex-wrap gap-2">
              {t.days.map((d, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs has-[:checked]:border-gold/60 has-[:checked]:bg-gold-soft has-[:checked]:text-gold">
                  <input type="checkbox" name="weekdays" value={i} defaultChecked={i === 0 || i === 3} className="sr-only" /> {d}
                </label>
              ))}
            </div>
            <FieldError name="weekdays" />
          </fieldset>
          <div><Label>{t.academy.instructor}</Label><Select name="instructorId"><option value="">—</option>{instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></div>
          <div><Label>{t.academy.cohortStatus}</Label><Select name="status" defaultValue="OPEN">{(["PLANNED", "OPEN", "IN_PROGRESS"] as const).map((s) => <option key={s} value={s}>{t.cohortStatus[s]}</option>)}</Select></div>
          <Notice className="md:col-span-2" tone="gold">{locale === "he" ? "6 מפגשים ייווצרו אוטומטית לפי ימי המפגש שנבחרו (פעמיים בשבוע). ניתן לערוך נושאים לכל מפגש לאחר היצירה." : "6 lessons are generated automatically on the selected weekdays (twice a week). Lesson topics can be edited afterwards."}</Notice>
          <div className="md:col-span-2 flex justify-end"><SubmitButton>{t.common.create}</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
