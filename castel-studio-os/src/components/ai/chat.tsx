"use client";
import { useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { Badge, Button, Select, Textarea } from "@/components/ui";

type Msg = { role: "user" | "assistant" | "system"; content: string; agent?: string | null };

export function AgentChat({ initial, conversationId: initialId, agents, labels, configured }: {
  initial: Msg[];
  conversationId: string | null;
  agents: { id: string; label: string }[];
  labels: { placeholder: string; send: string; auto: string; routedTo: string; notConfigured: string; error: string; approvals: string };
  configured: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [conversationId, setConversationId] = useState(initialId);
  const [agent, setAgent] = useState("auto");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const agentLabel = (id?: string | null) => agents.find((a) => a.id === id)?.label ?? id ?? "";

  async function send() {
    const text = ref.current?.value.trim();
    if (!text || pending) return;
    ref.current!.value = "";
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPending(true);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, conversationId, agent }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversationId(data.conversationId);
      const route: Msg = { role: "system", content: `${labels.routedTo}: ${agentLabel(data.agent)}${data.matched?.length ? ` (${data.matched.join(", ")})` : ""}`, agent: data.agent };
      if (!data.configured) setMessages((m) => [...m, route, { role: "system", content: labels.notConfigured }]);
      else if (data.error || !data.reply) setMessages((m) => [...m, route, { role: "system", content: labels.error }]);
      else setMessages((m) => [...m, route, { role: "assistant", content: data.reply, agent: data.agent }, ...(data.approvalsCreated?.length ? [{ role: "system" as const, content: `✓ ${data.approvalsCreated.length} → ${labels.approvals}` }] : [])]);
    } catch {
      setMessages((m) => [...m, { role: "system", content: labels.error }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col rounded-2xl border border-border bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!configured && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{labels.notConfigured}</p>}
        {messages.map((m, i) =>
          m.role === "system" ? (
            <p key={i} className="text-center text-[11px] text-muted">{m.content}</p>
          ) : (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-surface-3" : "bg-gold-soft text-gold"}`}>{m.role === "user" ? <User size={14} /> : <Bot size={14} />}</span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-surface-3" : "border border-border bg-surface-2"}`}>
                {m.agent && m.role === "assistant" && <Badge tone="gold" className="mb-1">{agentLabel(m.agent)}</Badge>}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ),
        )}
        {pending && <p className="animate-pulse text-xs text-muted">…</p>}
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 w-56">
          <Select value={agent} onChange={(e) => setAgent(e.target.value)} className="h-8 text-xs" aria-label="agent">
            <option value="auto">{labels.auto}</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <Textarea ref={ref} placeholder={labels.placeholder} className="min-h-12 flex-1" rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button onClick={send} disabled={pending} aria-label={labels.send}><Send size={15} className="rtl:-scale-x-100" /></Button>
        </div>
      </div>
    </div>
  );
}
