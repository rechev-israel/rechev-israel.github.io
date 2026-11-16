import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { AGENTS, AGENT_IDS } from "@/server/ai/agents";
import { aiConfigured } from "@/server/ai/provider";
import { AgentChat } from "@/components/ai/chat";
import { Badge, Card, CardTitle, Notice, PageHeader, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "AI Agents" };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("ai.use");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { c } = await searchParams;
  const [history, convo] = await Promise.all([
    db.aiConversation.findMany({ where: { businessId: user.businessId, userId: user.id }, orderBy: { updatedAt: "desc" }, take: 20 }),
    c ? db.aiConversation.findFirst({ where: { id: c, businessId: user.businessId, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null,
  ]);
  const agents = AGENT_IDS.filter((id) => !AGENTS[id].requires || can(user.role, AGENTS[id].requires!)).map((id) => ({ id, label: t.agents[id] }));
  const configured = aiConfigured();
  return (
    <>
      <PageHeader title={t.ai.title} subtitle={t.ai.subtitle} actions={<Badge tone={configured ? "success" : "warning"} className="h-8 px-3">{configured ? `Anthropic · ${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"}` : t.integrations.NOT_CONFIGURED}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <AgentChat
          key={convo?.id ?? "new"}
          initial={(convo?.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content, agent: m.role === "assistant" ? m.agent : null }))}
          conversationId={convo?.id ?? null}
          agents={agents}
          configured={configured}
          labels={{ placeholder: t.ai.placeholder, send: t.ai.send, auto: t.ai.auto, routedTo: t.ai.routedTo, notConfigured: t.ai.notConfigured, error: t.ai.error, approvals: t.nav.approvals }}
        />
        <div className="space-y-4">
          <Notice tone="gold">{t.ai.approvalNote}</Notice>
          <Notice tone="neutral">{t.ai.dataNote}</Notice>
          <Card className="p-4">
            <CardTitle action={<Link href="/agents" className={buttonClass("ghost", "sm")}>{t.ai.newChat}</Link>}>{t.ai.history}</CardTitle>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/agents?c=${h.id}`} className={`block rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2 ${h.id === convo?.id ? "bg-gold-soft text-gold" : ""}`}>
                    <span className="block truncate">{h.title}</span>
                    <span className="text-[10px] text-muted">{t.agents[h.agent as keyof typeof t.agents] ?? h.agent} · {formatDateTime(h.updatedAt, locale)}</span>
                  </Link>
                </li>
              ))}
              {!history.length && <li className="text-xs text-muted">{t.common.empty}</li>}
            </ul>
          </Card>
          <Card className="p-4">
            <CardTitle>{t.agents.orchestrator}</CardTitle>
            <ul className="space-y-1.5 text-xs">
              {AGENT_IDS.map((id) => <li key={id}><span className="text-gold">{t.agents[id]}</span><span className="block text-[11px] text-muted" dir="ltr">{AGENTS[id].brief}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
