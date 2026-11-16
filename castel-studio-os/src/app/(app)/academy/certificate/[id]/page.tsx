import { notFound } from "next/navigation";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDate, fullName } from "@/lib/utils";
import { totalInstructionalHours } from "@/domain/academy";
import { BrandMark } from "@/components/shell/brand";
import { Forbidden } from "@/components/forbidden";
import { PrintButton } from "@/components/print-button";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { id } = await params;
  const e = await db.enrollment.findFirst({
    where: { id, cohort: { course: { businessId: user.businessId } }, certificateNumber: { not: null } },
    include: { student: true, cohort: { include: { course: true, instructor: { select: { name: true } } } } },
  });
  if (!e) notFound();
  const c = e.cohort.course;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton label={t.common.print} /></div>
      <div className="print-plain relative aspect-[1.414] w-full overflow-hidden rounded-2xl border-2 border-gold/60 bg-[#0a0a0b] p-10 text-center text-[#f2ede3] print:bg-white print:text-black">
        <div className="absolute inset-3 rounded-xl border border-gold/30" />
        <div className="relative flex h-full flex-col items-center justify-center gap-4">
          <BrandMark size={64} />
          <p className="font-display text-sm tracking-[0.4em] text-[#c9a44c]">CASTEL STUDIO ACADEMY</p>
          <h1 className="font-display text-4xl font-bold md:text-5xl">{locale === "he" ? "תעודת סיום" : "Certificate of Completion"}</h1>
          <div className="gold-rule w-1/2" />
          <p className="text-sm text-[#9d978b]">{locale === "he" ? "מוענקת בזאת ל" : "This certifies that"}</p>
          <p className="font-display text-3xl font-bold text-[#e2c478] md:text-4xl">{fullName(e.student)}</p>
          <p className="max-w-xl text-sm leading-relaxed">
            {locale === "he"
              ? `על השלמת ${c.nameHe} — ${c.lessonCount} מפגשים, ${totalInstructionalHours(c.lessonDurations)} שעות הדרכה מעשית בספרות גברים.`
              : `has completed the ${c.nameEn} — ${c.lessonCount} lessons, ${totalInstructionalHours(c.lessonDurations)} hours of hands-on men's barbering instruction.`}
          </p>
          <div className="mt-6 grid w-full max-w-xl grid-cols-3 gap-4 text-xs text-[#9d978b]">
            <div><p className="border-t border-gold/40 pt-2">{e.cohort.instructor?.name ?? "CASTEL STUDIO"}</p><p>{t.academy.instructor}</p></div>
            <div><p className="border-t border-gold/40 pt-2" dir="ltr">{e.certificateNumber}</p><p>No.</p></div>
            <div><p className="border-t border-gold/40 pt-2">{formatDate(e.certificateIssuedAt, locale)}</p><p>{t.common.date}</p></div>
          </div>
          <p className="mt-2 text-[10px] text-[#6c665a]">{locale === "he" ? "אשקלון, ישראל · תעודה פנימית של האקדמיה ואינה מהווה הסמכה ממשלתית" : "Ashkelon, Israel · Internal academy certificate, not a government accreditation"}</p>
        </div>
      </div>
    </div>
  );
}
