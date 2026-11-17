import { z } from "zod";

/** Safe link: site-relative path, https URL, tel:, mailto:, or WhatsApp. Blocks javascript:, data:, http: etc. */
export const safeHref = z.string().trim().max(500).refine(
  (v) => v === "" || /^\/(?!\/)[\w\-./?=&#%]*$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v) || /^tel:\+?[\d-]{6,20}$/.test(v) || /^mailto:[^\s"'<>]+$/.test(v),
  "unsafe link",
);
const text = (max: number) => z.string().trim().max(max);
const id = z.string().regex(/^[a-z0-9]{8,40}$/i);

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: text(120), subtitle: text(300), ctaText: text(40), ctaHref: safeHref, imageAssetId: id.optional().or(z.literal("")) }),
  z.object({ type: z.literal("services"), title: text(80), showPrices: z.boolean() }),
  z.object({ type: z.literal("academy"), title: text(80) }),
  z.object({ type: z.literal("gallery"), title: text(80), assetIds: z.array(id).max(24) }),
  z.object({ type: z.literal("text"), title: text(120), body: text(4000) }),
  z.object({ type: z.literal("testimonials"), title: text(80), items: z.array(z.object({ quote: text(400), author: text(80) })).max(12) }),
  z.object({ type: z.literal("cta"), title: text(120), text: text(400), buttonText: text(40), buttonHref: safeHref }),
  z.object({ type: z.literal("leadForm"), title: text(120), kind: z.enum(["barbershop", "academy"]) }),
  z.object({ type: z.literal("contact"), title: text(80), phone: text(30), address: text(200), hours: text(300), instagram: safeHref, whatsapp: safeHref }),
]);
export type Block = z.infer<typeof blockSchema>;
export const blocksSchema = z.array(blockSchema).max(40);

export const pageMetaSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: a-z, 0-9, -").max(60),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
});

export const RESERVED_SLUGS = new Set(["admin", "api", "login", "setup", "join", "portal", "dashboard"]);

export function defaultBlocks(he: boolean): Block[] {
  return [
    { type: "hero", title: "CASTEL STUDIO", subtitle: he ? "ספרות גברים פרימיום ואקדמיה מקצועית באשקלון" : "Premium men's grooming & barber academy in Ashkelon", ctaText: he ? "קביעת תור" : "Book now", ctaHref: "https://cali-b5f0e.web.app/#/aeKiKr0vCLX", imageAssetId: "" },
    { type: "services", title: he ? "השירותים שלנו" : "Our services", showPrices: true },
    { type: "academy", title: "CASTEL STUDIO ACADEMY" },
    { type: "leadForm", title: he ? "השאירו פרטים ונחזור אליכם" : "Leave your details", kind: "barbershop" },
    { type: "contact", title: he ? "צרו קשר" : "Contact", phone: "", address: he ? "אשקלון" : "Ashkelon", hours: "", instagram: "https://www.instagram.com/castel.cutzz", whatsapp: "" },
  ];
}
