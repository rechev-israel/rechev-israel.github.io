import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { addMaterialAction, deleteMaterialAction } from "@/server/actions/academy";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { id } = await params;
  const course = await db.course.findFirst({ where: { id, businessId: user.businessId }, include: { materials: { orderBy: [{ lessonNumber: "asc" }, { createdAt: "asc" }] } } });
  if (!course) notFound();
  const edit = can(user.role, "academy.edit");
  return (
    <>
      <Link href="/academy" className="mb-3 inline-block text-xs text-muted hover:text-gold">← {t.academy.title}</Link>
      <PageHeader title={`${t.academy.materials} — ${locale === "he" ? course.nameHe : course.nameEn}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {course.materials.length ? (
            <ul className="space-y-2">
              {course.materials.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2"><Badge tone="gold">{m.kind}</Badge>{m.lessonNumber && <Badge>{t.academy.lesson} {m.lessonNumber}</Badge>}<span className="font-medium">{m.title}</span></div>
                    {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-gold underline" dir="ltr">{m.url}</a>}
                    {m.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{m.body}</p>}
                  </div>
                  {edit && <InlineAction action={deleteMaterialAction} fields={{ id: m.id }} confirm={t.common.delete + "?"}><Trash2 size={13} /></InlineAction>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title={t.common.empty} />}
        </Card>
        {edit && (
          <Card>
            <CardTitle>{t.academy.addMaterial}</CardTitle>
            <ActionForm action={addMaterialAction.bind(null, course.id)} resetOnSuccess className="space-y-3">
              <div><Label>{t.common.name} *</Label><Input name="title" required /><FieldError name="title" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Type</Label><Select name="kind">{["link", "pdf", "video", "note"].map((k) => <option key={k} value={k}>{k}</option>)}</Select></div>
                <div><Label>{t.academy.lesson}</Label><Input name="lessonNumber" type="number" min={1} max={course.lessonCount} /></div>
              </div>
              <div><Label>URL</Label><Input name="url" type="url" dir="ltr" placeholder="https://" /><FieldError name="url" /></div>
              <div><Label>{t.common.notes}</Label><Textarea name="body" /></div>
              <SubmitButton className="w-full">{t.common.add}</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
