import { redirect } from "next/navigation";
import { getI18n } from "@/i18n";
import { db } from "@/lib/db";
import { setupAction } from "@/server/actions/setup";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice } from "@/components/ui";
import { BrandMark, Wordmark } from "@/components/shell/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup" };

export default async function SetupPage() {
  const { locale } = await getI18n();
  const he = locale === "he";
  const users = await db.user.count();
  if (users > 0) redirect("/login");
  const tokenConfigured = Boolean(process.env.SETUP_TOKEN?.trim());
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} />
          <Wordmark sub={he ? "הגדרה ראשונית" : "First-time setup"} />
        </div>
        {!tokenConfigured ? (
          <Notice tone="warning">
            {he
              ? "ההגדרה הראשונית נעולה. הוסיפו ב-Vercel משתנה סביבה SETUP_TOKEN (לפחות 12 תווים), בצעו Redeploy וחזרו לעמוד זה."
              : "Setup is locked. Add a SETUP_TOKEN environment variable (12+ characters) in Vercel, redeploy, and return to this page."}
          </Notice>
        ) : (
          <ActionForm action={setupAction} className="space-y-4">
            <Notice tone="gold">
              {he
                ? "יצירת חשבון הבעלים. העמוד זמין רק כל עוד אין משתמשים במערכת. ייווצרו גם קורסי האקדמיה (קבוצתי ו-VIP)."
                : "Create the owner account. This page only works while the system has no users. Academy courses (Group & VIP) are created too."}
            </Notice>
            <div><Label htmlFor="token">SETUP_TOKEN</Label><Input id="token" name="token" type="password" required autoComplete="off" dir="ltr" /><FieldError name="token" /></div>
            <div><Label htmlFor="name">{he ? "שם מלא" : "Full name"}</Label><Input id="name" name="name" required autoComplete="name" /><FieldError name="name" /></div>
            <div><Label htmlFor="email">{he ? "אימייל" : "Email"}</Label><Input id="email" name="email" type="email" required autoComplete="username" dir="ltr" /><FieldError name="email" /></div>
            <div><Label htmlFor="password">{he ? "סיסמה (10+ תווים, אותיות וספרות)" : "Password (10+ chars, letters & digits)"}</Label><Input id="password" name="password" type="password" required autoComplete="new-password" minLength={10} dir="ltr" /><FieldError name="password" /></div>
            <SubmitButton className="w-full">{he ? "יצירת חשבון בעלים" : "Create owner account"}</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </main>
  );
}
