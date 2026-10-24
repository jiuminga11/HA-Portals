import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { getSiteConfig } from "../../api/siteConfig";
import type { SiteConfig } from "../../types";
import { useTheme } from "../../hooks/useTheme";
import { useLocale } from "../../hooks/useLocale";
import zh from "../../locales/a11y.zh.json";
import en from "../../locales/a11y.en.json";

export interface PublicPageContext {
  siteConfig: SiteConfig | null;
  onPageReady: () => (() => void);
}

function applyTheme(config: SiteConfig) {
  const root = document.documentElement;
  // Set data-theme attribute — CSS handles all color variables (see themes.css)
  root.setAttribute("data-theme", config.theme_preset || "teal-amber");
  // Individual color overrides from config (fine-tuning)
  for (const [key, value] of [["--color-primary", config.primary_color], ["--color-gradient", config.gradient_color], ["--color-accent", config.accent_color]]) {
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  }
  // Font size scaling
  const fontSizeMap: Record<string, string> = {
    standard: "16px",
    large: "18px",
    "extra-large": "20px",
  };
  root.style.fontSize = fontSizeMap[config.font_size] || "16px";
}

export default function PublicLayout() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const { setTheme } = useTheme();
  const { locale } = useLocale();
  const labels = locale === "en" ? en : zh;
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(location);
  const positions = useRef(new Map<string, number>());
  const plan = useRef<{ key: string; top?: number; focus: boolean } | null>(null);

  useLayoutEffect(() => {
    const old = previous.current;
    if (old.key !== location.key) {
      const samePage = old.pathname.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "") === location.pathname.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "");
      const top = positions.current.get(old.key) ?? window.scrollY;
      plan.current = {
        key: location.key,
        top: navigationType === "POP" ? positions.current.get(location.key) : samePage ? top : 0,
        focus: navigationType !== "POP" && !samePage && !location.hash,
      };
    }
    previous.current = location;
  }, [location, navigationType]);

  useEffect(() => {
    const remember = () => { positions.current.set(location.key, window.scrollY); };
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [location.key]);

  // Run after async page content is committed, not merely when the URL changes.
  const onPageReady = useCallback(() => {
    const frame = requestAnimationFrame(() => {
      const pending = plan.current?.key === location.key ? plan.current : null;
      if (location.hash) {
        let id = location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* Keep literal malformed fragment. */ }
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "instant" });
        else if (pending?.top !== undefined) window.scrollTo({ top: pending.top, behavior: "instant" });
      } else if (pending) {
        if (pending.focus) {
          const target = document.querySelector<HTMLElement>("#main-content h1") ?? document.getElementById("main-content");
          if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
        }
        if (pending.top !== undefined) window.scrollTo({ top: pending.top, behavior: "instant" });
      }
      plan.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

  // Fetch site config: apply theme + share with children
  useEffect(() => {
    let cancelled = false;
    getSiteConfig()
      .then((config) => {
        if (!cancelled) {
          setSiteConfig(config);
          applyTheme(config);
          // A site default is not a user preference. Keep the preference absent
          // so a future site-default change can still apply on the next visit.
          if (!localStorage.getItem("theme") && ["light", "dark", "system"].includes(config.default_theme)) {
            const theme = config.default_theme;
            if (theme === "light" || theme === "dark" || theme === "system") {
              setTheme(theme);
              localStorage.removeItem("theme");
            }
          }
        }
      })
      .catch((err) => {
        console.warn("[HA-PORTALS] Failed to load site config:", err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [setTheme]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <a href="#main-content" className="skip-link" data-no-print onClick={() => document.getElementById("main-content")?.focus({ preventScroll: true })}>{labels.skipToContent}</a>
      <Header siteConfig={siteConfig} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Outlet context={{ siteConfig, onPageReady } satisfies PublicPageContext} />
      </main>
      <Footer siteConfig={siteConfig} />
    </div>
  );
}
