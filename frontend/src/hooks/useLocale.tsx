import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import zh from "../locales/zh.json";
import en from "../locales/en.json";

type Locale = "zh" | "en";
type Translations = typeof zh;

const translations: Record<Locale, Translations> = { zh, en };

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  /** Get bilingual field value based on current locale */
  localized: (zh: string, en: string) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("locale");
    return (saved === "en" ? "en" : "zh") as Locale;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const localized = useCallback((zhText: string, enText: string) => {
    if (locale === "en" && enText) return enText;
    return zhText; // fallback to Chinese
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translations[locale], localized }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
