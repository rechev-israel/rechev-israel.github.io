import Link from "next/link";
import { Plus } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, fullName } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function StudentsPage() {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const students = await db.student.findMany({
    where: { businessId: user.businessId },
    orderBy: { createdAt: "desc" },
    include: { enrollments: { include: { cohort: { select: { id: true, name: true } } } } },
  });
  return (
    <>
      <Link href="/academy" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.academy.title}</Link>
      <PageHeader title={t.academy.students} actions={can(user.role, "academy.edit") && <Link href="/academy/students/new" className={buttonClass()}><Plus size={14} /> {t.academy.newStudent}</Link>} />
      <Card>
        {students.length ? (
          <Table>
            <thead><tr><Th>{t.common.name}</Th><Th>{t.common.phone}</Th><Th>{t.common.status}</Th><Th>{t.academy.cohorts}</Th><Th>{t.common.createdAt}</Th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <Td><Link href={`/academy/students/${s.id}`} className="font-medium hover:text-gold">{fullName(s)}</Link></Td>
                  <Td dir="ltr" className="text-muted">{s.phone ?? "—"}</Td>
                  <Td><Badge tone={s.status === "GRADUATED" ? "gold" : s.status === "DROPPED" ? "danger" : "info"}>{t.studentStatus[s.status]}</Badge></Td>
                  <Td className="text-xs">{s.enrollments.map((e) => <Link key={e.id} href={`/academy/cohorts/${e.cohort.id}`} className="me-2 hover:text-gold">{e.cohort.name}</Link>)}</Td>
                  <Td className="text-muted">{formatDate(s.createdAt, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title={t.common.empty} />}
      </Card>
    </>
  );
}
