"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Save, ImagePlus } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

type Brand = { displayName: string; tagline: string | null; primaryColor: string; accentColor: string; textColor: string; handle: string | null };
type Template = "promo" | "academy" | "quote" | "announce";
type Size = "post" | "story" | "landscape";
const SIZES: Record<Size, [number, number]> = { post: [1080, 1080], story: [1080, 1920], landscape: [1200, 630] };
const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** Word-wrap text to a max width; returns lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function GraphicDesigner({ brand, onSave, labels }: {
  brand: Brand;
  onSave: (input: { title: string; dataUrl: string; template: string; size: string }) => Promise<ActionState>;
  labels: Record<string, string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<Template>("promo");
  const [size, setSize] = useState<Size>("post");
  const [headline, setHeadline] = useState(labels.defHeadline);
  const [body, setBody] = useState(labels.defBody);
  const [badge, setBadge] = useState(labels.defBadge);
  const [cta, setCta] = useState(labels.defCta);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<string>("");
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      document.fonts.load('900 80px "Frank Ruhl Libre"', "אבג"),
      document.fonts.load('700 40px "Heebo"', "אבג"),
      document.fonts.load('400 40px "Heebo"', "אבג"),
    ]).finally(() => setFontsReady(true));
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const [W, H] = SIZES[size];
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    const gold = brand.accentColor;
    // Background
    ctx.fillStyle = brand.primaryColor; ctx.fillRect(0, 0, W, H);
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0.35)"); grad.addColorStop(0.55, "rgba(0,0,0,0.55)"); grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createRadialGradient(W / 2, -H * 0.1, 10, W / 2, H * 0.2, Math.max(W, H));
      g.addColorStop(0, gold + "55"); g.addColorStop(0.5, gold + "10"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Frame
    const pad = Math.round(W * 0.045);
    ctx.strokeStyle = gold + "aa"; ctx.lineWidth = Math.max(2, W * 0.003); ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    // Brand mark + name
    const markR = W * 0.045;
    const topY = pad + markR * 2.2;
    ctx.strokeStyle = gold; ctx.lineWidth = W * 0.006;
    ctx.beginPath(); ctx.arc(W / 2, topY, markR, Math.PI * 0.25, Math.PI * 1.75); ctx.stroke();
    ctx.fillStyle = gold; ctx.textAlign = "center"; ctx.direction = "ltr";
    ctx.font = `700 ${Math.round(W * 0.03)}px "Frank Ruhl Libre", serif`;
    ctx.fillText(brand.displayName.split("").join(String.fromCharCode(8202)), W / 2, topY + markR + W * 0.05);

    const rtl = hasHebrew(headline + body + cta);
    ctx.direction = rtl ? "rtl" : "ltr";
    const maxW = W - pad * 4;
    let y = size === "story" ? H * 0.34 : size === "landscape" ? H * 0.42 : H * 0.36;

    if (template === "quote") {
      ctx.fillStyle = gold; ctx.font = `900 ${Math.round(W * 0.16)}px "Frank Ruhl Libre", serif`; ctx.fillText("”", W / 2, y); y += W * 0.06;
    }
    // Headline
    const hSize = Math.round(W * (template === "quote" ? 0.06 : size === "landscape" ? 0.06 : 0.085));
    ctx.fillStyle = brand.textColor; ctx.font = `900 ${hSize}px "Frank Ruhl Libre", serif`;
    for (const line of wrap(ctx, headline, maxW)) { ctx.fillText(line, W / 2, y); y += hSize * 1.15; }
    // Divider
    y += hSize * 0.15; ctx.fillStyle = gold; ctx.fillRect(W / 2 - W * 0.08, y, W * 0.16, Math.max(2, W * 0.003)); y += hSize * 0.6;
    // Body
    const bSize = Math.round(W * (size === "landscape" ? 0.03 : 0.036));
    ctx.fillStyle = brand.textColor + "dd"; ctx.font = `400 ${bSize}px "Heebo", sans-serif`;
    for (const line of wrap(ctx, body, maxW).slice(0, size === "story" ? 10 : 5)) { ctx.fillText(line, W / 2, y); y += bSize * 1.45; }
    // Badge (price / date)
    if (badge && template !== "quote") {
      y += bSize * 0.6;
      ctx.font = `900 ${Math.round(W * 0.07)}px "Frank Ruhl Libre", serif`;
      const bw = ctx.measureText(badge).width + W * 0.08, bh = W * 0.1;
      ctx.fillStyle = gold + "22"; ctx.strokeStyle = gold; ctx.lineWidth = W * 0.003;
      const bx = W / 2 - bw / 2; ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, bh / 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold; ctx.textBaseline = "middle"; ctx.fillText(badge, W / 2, y + bh / 2); ctx.textBaseline = "alphabetic"; y += bh;
    }
    // CTA button at bottom
    const ctaY = H - pad - W * (size === "landscape" ? 0.1 : 0.17);
    if (cta) {
      ctx.font = `700 ${Math.round(W * 0.038)}px "Heebo", sans-serif`;
      const cw = ctx.measureText(cta).width + W * 0.12, ch = W * 0.085;
      ctx.fillStyle = gold; ctx.beginPath(); ctx.roundRect(W / 2 - cw / 2, ctaY, cw, ch, ch / 2); ctx.fill();
      ctx.fillStyle = brand.primaryColor; ctx.textBaseline = "middle"; ctx.fillText(cta, W / 2, ctaY + ch / 2); ctx.textBaseline = "alphabetic";
    }
    // Footer handle / tagline
    ctx.direction = "ltr"; ctx.fillStyle = brand.textColor + "99"; ctx.font = `400 ${Math.round(W * 0.026)}px "Heebo", sans-serif`;
    ctx.fillText([brand.handle, brand.tagline].filter(Boolean).join("  ·  "), W / 2, H - pad - W * 0.035);
  }, [size, template, headline, body, badge, cta, bg, brand]);

  useEffect(() => { if (fontsReady) draw(); }, [fontsReady, draw]);

  const exportUrl = (type: "image/png" | "image/jpeg", q?: number) => canvasRef.current!.toDataURL(type, q);
  const download = () => {
    const a = document.createElement("a");
    a.href = exportUrl("image/png");
    a.download = `castel-${template}-${size}.png`;
    a.click();
  };
  const save = async () => {
    setStatus("…");
    let data = exportUrl("image/jpeg", 0.9);
    if (data.length > 3_300_000) data = exportUrl("image/jpeg", 0.75);
    const r = await onSave({ title: headline.slice(0, 100) || template, dataUrl: data, template, size });
    setStatus(r?.error ? `✕ ${r.error}` : `✓ ${labels.saved}`);
  };
  const onFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/") || f.size > 15_000_000) return;
    const img = new Image();
    img.onload = () => setBg(img);
    img.src = URL.createObjectURL(f);
  };
  const applyTemplate = (t: Template) => {
    setTemplate(t);
    const d = { promo: [labels.defHeadline, labels.defBody, labels.defBadge, labels.defCta], academy: [labels.acHeadline, labels.acBody, labels.acBadge, labels.acCta], quote: [labels.qHeadline, labels.qBody, "", ""], announce: [labels.anHeadline, labels.anBody, labels.anBadge, labels.anCta] }[t];
    setHeadline(d[0]); setBody(d[1]); setBadge(d[2]); setCta(d[3]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{labels.template}</Label><Select value={template} onChange={(e) => applyTemplate(e.target.value as Template)}><option value="promo">{labels.tPromo}</option><option value="academy">{labels.tAcademy}</option><option value="quote">{labels.tQuote}</option><option value="announce">{labels.tAnnounce}</option></Select></div>
          <div><Label>{labels.size}</Label><Select value={size} onChange={(e) => setSize(e.target.value as Size)}><option value="post">Post 1080×1080</option><option value="story">Story 1080×1920</option><option value="landscape">Landscape 1200×630</option></Select></div>
        </div>
        <div><Label>{labels.headline}</Label><Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={90} /></div>
        <div><Label>{labels.body}</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={400} /></div>
        {template !== "quote" && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label>{labels.badge}</Label><Input value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={24} /></div>
            <div><Label>{labels.cta}</Label><Input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={30} /></div>
          </div>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-muted hover:border-gold/50">
          <ImagePlus size={16} /> {bg ? labels.bgChange : labels.bgAdd}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {bg && <button type="button" className="text-xs text-muted underline" onClick={() => setBg(null)}>{labels.bgRemove}</button>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={download}><Download size={14} /> PNG</Button>
          <Button type="button" variant="secondary" onClick={save}><Save size={14} /> {labels.save}</Button>
        </div>
        {status && <p className="text-xs text-muted">{status}</p>}
      </div>
      <div className="flex items-start justify-center rounded-2xl border border-border bg-surface-2 p-3">
        <canvas ref={canvasRef} className="h-auto max-h-[75dvh] w-auto max-w-full rounded-lg shadow-2xl" aria-label="preview" />
      </div>
    </div>
  );
}
