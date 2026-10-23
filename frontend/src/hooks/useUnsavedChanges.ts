import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { useLocale } from "./useLocale";
import zh from "../locales/auth.zh.json";
import en from "../locales/auth.en.json";

export function useUnsavedChanges(dirty: boolean) {
  const { locale } = useLocale();
  const bypass = useRef(false);
  const confirming = useRef(false);
  const blocker = useBlocker(useCallback(() => {
    if (bypass.current) {
      bypass.current = false;
      return false;
    }
    return dirty;
  }, [dirty]));

  useEffect(() => {
    if (blocker.state !== "blocked" || confirming.current) return;
    confirming.current = true;
    try {
      if (window.confirm((locale === "en" ? en : zh).unsavedChanges)) blocker.proceed();
      else blocker.reset();
    } finally {
      confirming.current = false;
    }
  }, [blocker, locale]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const allowNextNavigation = useCallback(() => { bypass.current = true; }, []);
  return { allowNextNavigation };
}
