"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type Block = Record<string, unknown> & { type: string };
type Asset = { id: string; title: string };

const NEW: Record<string, Block> = {
  hero: { type: "hero", title: "", subtitle: "", ctaText: "", ctaHref: "", imageAssetId: "" },
  services: { type: "services", title: "", showPrices: true },
  academy: { type: "academy", title: "CASTEL STUDIO ACADEMY" },
  gallery: { type: "gallery", title: "", assetIds: [] },
  text: { type: "text", title: "", body: "" },
  testimonials: { type: "testimonials", title: "", items: [{ quote: "", author: "" }] },
  cta: { type: "cta", title: "", text: "", buttonText: "", buttonHref: "" },
  leadForm: { type: "leadForm", title: "", kind: "barbershop" },
  contact: { type: "contact", title: "", phone: "", address: "", hours: "", instagram: "", whatsapp: "" },
};

export function BlockEditor({ initial, assets, labels }: { initial: Block[]; assets: Asset[]; labels: Record<string, string> }) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const json = useMemo(() => JSON.stringify(blocks), [blocks]);
  const set = (i: number, patch: Record<string, unknown>) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => setBlocks((bs) => { const c = [...bs]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const field = (i: number, key: string, label: string, opts: { area?: boolean; ltr?: boolean; max?: number } = {}) => (
    <div className={opts.area ? "sm:col-span-2" : ""}>
      <Label>{label}</Label>
      {opts.area
        ? <Textarea value={String(blocks[i][key] ?? "")} onChange={(e) => set(i, { [key]: e.target.value })} rows={4} maxLength={opts.max} />
        : <Input value={String(blocks[i][key] ?? "")} onChange={(e) => set(i, { [key]: e.target.value })} dir={opts.ltr ? "ltr" : undefined} maxLength={opts.max} />}
    </div>
  );
  return (
    <div className="space-y-3">
      <input type="hidden" name="blocks" value={json} />
      {blocks.map((b, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gold">{i + 1}. {labels[`b_${b.type}`] ?? b.type}</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" aria-label="up" onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
              <Button type="button" size="sm" variant="ghost" aria-label="down" onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
              <Button type="button" size="sm" variant="ghost" aria-label={labels.remove} onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {"title" in b && field(i, "title", labels.title, { max: 120 })}
            {b.type === "hero" && (<>
              {field(i, "subtitle", labels.subtitle, { area: true, max: 300 })}
              {field(i, "ctaText", labels.buttonText, { max: 40 })}
              {field(i, "ctaHref", labels.link, { ltr: true, max: 500 })}
              <div><Label>{labels.image}</Label><Select value={String(b.imageAssetId ?? "")} onChange={(e) => set(i, { imageAssetId: e.target.value })}><option value="">—</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</Select></div>
            </>)}
            {b.type === "services" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(b.showPrices)} onChange={(e) => set(i, { showPrices: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" /> {labels.showPrices}</label>}
            {b.type === "text" && field(i, "body", labels.body, { area: true, max: 4000 })}
            {b.type === "cta" && (<>{field(i, "text", labels.body, { area: true, max: 400 })}{field(i, "buttonText", labels.buttonText, { max: 40 })}{field(i, "buttonHref", labels.link, { ltr: true, max: 500 })}</>)}
            {b.type === "leadForm" && <div><Label>{labels.leadKind}</Label><Select value={String(b.kind)} onChange={(e) => set(i, { kind: e.target.value })}><option value="barbershop">{labels.kindShop}</option><option value="academy">{labels.kindAcademy}</option></Select></div>}
            {b.type === "contact" && (<>{field(i, "phone", labels.phone, { ltr: true, max: 30 })}{field(i, "address", labels.address, { max: 200 })}{field(i, "instagram", "Instagram (https://…)", { ltr: true, max: 500 })}{field(i, "whatsapp", "WhatsApp (https://wa.me/…)", { ltr: true, max: 500 })}{field(i, "hours", labels.hours, { area: true, max: 300 })}</>)}
            {b.type === "gallery" && (
              <div className="sm:col-span-2">
                <Label>{labels.images}</Label>
                {assets.length === 0 ? <p className="text-xs text-muted">{labels.noAssets}</p> : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {assets.map((a) => {
                      const ids = (b.assetIds as string[]) ?? [];
                      const on = ids.includes(a.id);
                      return (
                        <button type="button" key={a.id} onClick={() => set(i, { assetIds: on ? ids.filter((x) => x !== a.id) : [...ids, a.id] })} className={`overflow-hidden rounded-lg border-2 ${on ? "border-gold" : "border-transparent opacity-60"}`} aria-pressed={on} title={a.title}>
                          <img src={`/api/assets/${a.id}`} alt={a.title} className="aspect-square w-full object-cover" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {b.type === "testimonials" && (
              <div className="space-y-2 sm:col-span-2">
                {((b.items as { quote: string; author: string }[]) ?? []).map((it, j) => (
                  <div key={j} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                    <Input value={it.quote} placeholder={labels.quote} maxLength={400} onChange={(e) => set(i, { items: (b.items as { quote: string; author: string }[]).map((x, k) => (k === j ? { ...x, quote: e.target.value } : x)) })} />
                    <Input value={it.author} placeholder={labels.author} maxLength={80} onChange={(e) => set(i, { items: (b.items as { quote: string; author: string }[]).map((x, k) => (k === j ? { ...x, author: e.target.value } : x)) })} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => set(i, { items: (b.items as unknown[]).filter((_, k) => k !== j) })}><Trash2 size={13} /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => set(i, { items: [...((b.items as unknown[]) ?? []), { quote: "", author: "" }] })}><Plus size={13} /> {labels.addTestimonial}</Button>
              </div>
            )}
          </div>
        </div>
      ))}
      <Select aria-label={labels.addBlock} value="" onChange={(e) => { const t = e.target.value; if (t) setBlocks((bs) => [...bs, structuredClone(NEW[t])]); }} className="w-full sm:w-72">
        <option value="">+ {labels.addBlock}…</option>
        {Object.keys(NEW).map((k) => <option key={k} value={k}>{labels[`b_${k}`] ?? k}</option>)}
      </Select>
    </div>
  );
}
