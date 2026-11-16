import { redirect } from "next/navigation";
import { getI18n } from "@/i18n";
import { getSessionUser } from "@/server/auth/session";
import { loginAction } from "@/server/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Input, Label } from "@/components/ui";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  const { t, locale } = await getI18n();
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.14),transparent_60%)]" />
      <div className="absolute end-4 top-4"><PreferenceToggles locale={locale} t={t} /></div>
      <Card className="relative w-full max-w-sm p-8 animate-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={52} />
          <Wordmark sub={t.app.tagline} />
          <div className="gold-rule mt-2 w-full" />
          <p className="text-sm text-muted">{t.auth.title}</p>
        </div>
        <ActionForm action={loginAction} className="space-y-4">
          <div>
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required dir="ltr" />
          </div>
          <div>
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
          </div>
          <SubmitButton className="w-full">{t.auth.signIn}</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
