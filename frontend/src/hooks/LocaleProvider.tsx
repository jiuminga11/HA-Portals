import { useCallback, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPathLocale, localePath } from "../lib/localePath";
import { LocaleContext, type Locale, type Translations } from "./LocaleContext";
import zh from "../locales/zh.json";
import en from "../locales/en.json";

const translations: Record<Locale, Translations> = { zh, en };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = getPathLocale(location.pathname);

  const setLocale = useCallback((newLocale: Locale) => {
    navigate({
      pathname: localePath(location.pathname, newLocale),
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

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
