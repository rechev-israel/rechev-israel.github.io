import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { createTaskAction, setTaskStatusAction } from "@/server/actions/system";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { user, t, locale } = await pageGuard();
  const [tasks, users] = await Promise.all([
    db.task.findMany({ where: { businessId: user.businessId }, orderBy: [{ status: "asc" }, { priority: "asc" }, { dueAt: "asc" }], include: { assignee: { select: { name: true } } }, take: 200 }),
    db.user.findMany({ where: { businessId: user.businessId, isActive: true }, select: { id: true, name: true } }),
  ]);
  const pr = (p: number) => (p === 1 ? t.tasks.high : p === 2 ? t.tasks.normal : t.tasks.low);
  return (
    <>
      <PageHeader title={t.tasks.title} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>{t.tasks.new}</CardTitle>
          <ActionForm action={createTaskAction} resetOnSuccess className="space-y-3">
            <div><Label>{t.common.name} *</Label><Input name="title" required /><FieldError name="title" /></div>
            <div><Label>{t.common.description}</Label><Textarea name="details" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.tasks.priority}</Label><Select name="priority" defaultValue="2"><option value="1">{t.tasks.high}</option><option value="2">{t.tasks.normal}</option><option value="3">{t.tasks.low}</option></Select></div>
              <div><Label>{t.tasks.due}</Label><Input name="dueAt" type="date" /></div>
            </div>
            <div><Label>{t.tasks.assignee}</Label><Select name="assigneeId" defaultValue={user.id}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></div>
            <SubmitButton className="w-full">{t.common.add}</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="lg:col-span-2">
          {tasks.length ? (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className={`flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3 ${task.status === "DONE" ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${task.status === "DONE" ? "line-through" : ""}`}>{task.title}</p>
                    {task.details && (task.details.startsWith("/") ? <Link href={task.details} className="text-xs text-gold underline">{task.details}</Link> : <p className="text-xs text-muted">{task.details}</p>)}
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <Badge tone={task.priority === 1 ? "danger" : "neutral"}>{pr(task.priority)}</Badge>
                      {task.dueAt && <Badge tone={task.dueAt < new Date() && task.status !== "DONE" ? "warning" : "neutral"}>{t.tasks.due}: {formatDate(task.dueAt, locale)}</Badge>}
                      {task.assignee && <Badge>{task.assignee.name}</Badge>}
                      {task.source !== "manual" && <Badge tone="info">{task.source}</Badge>}
                    </div>
                  </div>
                  <InlineAction action={setTaskStatusAction} fields={{ id: task.id, status: task.status === "DONE" ? "OPEN" : "DONE" }} variant={task.status === "DONE" ? "ghost" : "outline"}>
                    {task.status === "DONE" ? t.tasks.reopen : t.tasks.done}
                  </InlineAction>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={t.common.empty} />}
        </Card>
      </div>
    </>
  );
}
