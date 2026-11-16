import { CheckCircle2, Circle, KeyRound } from "lucide-react";
import { ROADMAP } from "@/lib/roadmap";
import { pageGuard } from "@/server/auth/guard";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui";

export async function RoadmapPage({ module }: { module: keyof typeof ROADMAP }) {
  const { t, locale } = await pageGuard();
  const r = ROADMAP[module];
  const L = (x: { he: string; en: string }) => (locale === "he" ? x.he : x.en);
  return (
    <>
      <PageHeader title={L(r.title)} actions={<Badge tone="info" className="h-8 px-3">{t.planned.phase} {r.phase} · {t.app.planned}</Badge>} />
      <Notice tone="neutral" className="mb-4">{t.planned.body}</Notice>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardTitle>{t.planned.ready}</CardTitle><ul className="space-y-2 text-sm">{r.ready.map((x, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />{L(x)}</li>)}</ul></Card>
        <Card><CardTitle>{t.planned.next}</CardTitle><ul className="space-y-2 text-sm">{r.next.map((x, i) => <li key={i} className="flex gap-2"><Circle size={15} className="mt-0.5 shrink-0 text-muted" />{L(x)}</li>)}</ul></Card>
        <Card><CardTitle>{t.planned.needs}</CardTitle><ul className="space-y-2 text-sm">{r.requires.map((x, i) => <li key={i} className="flex gap-2"><KeyRound size={15} className="mt-0.5 shrink-0 text-warning" />{L(x)}</li>)}</ul></Card>
      </div>
    </>
  );
}
