import "server-only";
import { cookies } from "next/headers";
import { he, type Dictionary } from "./he";
import { en } from "./en";

export type Locale = "he" | "en";
export const LOCALE_COOKIE = "castel_locale";
export const THEME_COOKIE = "castel_theme";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return v === "en" ? "en" : "he";
}

export async function getTheme(): Promise<"dark" | "light"> {
  return (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}

export function dictFor(locale: Locale): Dictionary {
  return locale === "en" ? en : he;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictFor(locale), dir: locale === "he" ? ("rtl" as const) : ("ltr" as const) };
}

export { fmt } from "./fmt";
