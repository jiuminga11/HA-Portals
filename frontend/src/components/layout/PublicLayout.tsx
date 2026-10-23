import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { getSiteConfig } from "../../api/siteConfig";
import type { SiteConfig } from "../../types";
import { useTheme } from "../../hooks/useTheme";

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
      <Header siteConfig={siteConfig} />
      <main className="flex-1 pt-16">
        <Outlet context={{ siteConfig }} />
      </main>
      <Footer siteConfig={siteConfig} />
    </div>
  );
}
