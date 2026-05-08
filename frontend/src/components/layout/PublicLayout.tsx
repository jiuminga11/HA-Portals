import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { getSiteConfig } from "../../api/siteConfig";
import type { SiteConfig } from "../../types";

function applyTheme(config: SiteConfig) {
  const root = document.documentElement;
  // Clear any inline style overrides from admin preview
  root.style.cssText = "";
  // Set data-theme attribute — CSS handles all color variables (see themes.css)
  root.setAttribute("data-theme", config.theme_preset || "teal-amber");
  // Individual color overrides from config (fine-tuning)
  if (config.primary_color) root.style.setProperty("--color-primary", config.primary_color);
  if (config.gradient_color) root.style.setProperty("--color-gradient", config.gradient_color);
  if (config.accent_color) root.style.setProperty("--color-accent", config.accent_color);
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

  // Fetch site config: apply theme + share with children
  useEffect(() => {
    let cancelled = false;
    getSiteConfig()
      .then((config) => {
        if (!cancelled) {
          setSiteConfig(config);
          applyTheme(config);
        }
      })
      .catch((err) => {
        console.warn("[HA-PORTALS] Failed to load site config:", err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header siteConfig={siteConfig} />
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
