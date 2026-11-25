import { en } from "./en";
import { fr, type Dictionary } from "./fr";

export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: string | null | undefined = DEFAULT_LOCALE): Dictionary {
  return dictionaries[(locale as Locale) in dictionaries ? (locale as Locale) : DEFAULT_LOCALE];
}

/** Remplace les variables {cle} d'une chaîne traduite. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export type { Dictionary };
