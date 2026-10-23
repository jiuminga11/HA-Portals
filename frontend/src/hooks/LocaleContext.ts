import { createContext } from "react";
import type zh from "../locales/zh.json";

export type Locale = "zh" | "en";
export type Translations = typeof zh;

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  /** Get bilingual field value based on current locale */
  localized: (zh: string, en: string) => string;
}

export const LocaleContext = createContext<LocaleContextType | null>(null);
