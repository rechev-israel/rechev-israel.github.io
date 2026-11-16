import { Languages, Moon, Sun } from "lucide-react";
import { setPreferenceAction } from "@/server/actions/auth";
import { getTheme } from "@/i18n";
import type { Dictionary } from "@/i18n/he";

export async function PreferenceToggles({ locale, t }: { locale: string; t: Dictionary }) {
  const theme = await getTheme();
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs text-muted hover:text-text hover:border-gold/40 transition-colors";
  return (
    <div className="flex items-center gap-2">
      <form action={setPreferenceAction}>
        <input type="hidden" name="locale" value={locale === "he" ? "en" : "he"} />
        <button className={btn} title={t.common.language} aria-label={t.common.language}>
          <Languages size={14} /> {locale === "he" ? "EN" : "עב"}
        </button>
      </form>
      <form action={setPreferenceAction}>
        <input type="hidden" name="theme" value={theme === "dark" ? "light" : "dark"} />
        <button className={btn} title={t.common.theme} aria-label={t.common.theme}>
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </form>
    </div>
  );
}
