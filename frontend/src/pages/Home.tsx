import { useEffect, useState } from "react";
import type { SiteConfig, Section } from "../types";
import { getSiteConfig } from "../api/siteConfig";
import { getPageSections } from "../api/pages";
import Header, { getDisplayConfig } from "../components/layout/HeroBanner";
import TopNav from "../components/layout/TopNav";
import Footer from "../components/layout/LegacyFooter";
import SectionRenderer from "../components/display/SectionRenderer";
import { useActiveSection } from "../hooks/useActiveSection";

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
  const fontSizeMap: Record<string, string> = { standard: "16px", large: "18px", "extra-large": "20px" };
  root.style.fontSize = fontSizeMap[config.font_size] || "16px";
}


export default function Home() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [config, secs] = await Promise.all([getSiteConfig(), getPageSections("home")]);
        setSiteConfig(config);
        setSections(secs.filter(s => s.visible));
        applyTheme(config);
        const display = getDisplayConfig(config);
        document.title = display.displayTitle;
      } catch (err) {
        console.error("Failed to load home page data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sectionDomIds = sections.map((s) => `section-${s.id}`);
  const activeId = useActiveSection(sectionDomIds);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="text-center">
          {/* Animated rings loader */}
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div
              className="absolute inset-0 rounded-full border-2 animate-spin"
              style={{ borderColor: 'transparent', borderTopColor: '#3B82F6' }}
            />
            <div
              className="absolute inset-2 rounded-full border-2 animate-spin"
              style={{
                borderColor: 'transparent',
                borderTopColor: '#06B6D4',
                animationDirection: 'reverse',
                animationDuration: '0.8s',
              }}
            />
            <div
              className="absolute inset-4 rounded-full"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            />
          </div>
          <p className="text-sm" style={{ color: '#64748B', letterSpacing: '0.1em' }}>
            加载中...
          </p>
        </div>
      </div>
    );
  }

  // Fallback config
  const config: SiteConfig = siteConfig || {
    site_title: "HA-PORTALS",
    project_title: "",
    logo_url: null,
    banner_url: null,
    footer_text: "",
    primary_color: "#1E3A8A",
    gradient_color: "#3B82F6",
    accent_color: "#0284C7",
    theme_preset: "academic-slate-blue",
    font_size: "standard",
    default_theme: "system",
    default_locale: "zh",
    seo_default_title_zh: "",
    seo_default_title_en: "",
    seo_default_description_zh: "",
    seo_default_description_en: "",
    seo_og_image: null,
    updated_at: "",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Header siteConfig={config} />
      {sections.length > 0 && (
        <TopNav sections={sections} activeId={activeId} />
      )}

      <main className="flex-1">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32" style={{ color: '#475569' }}>
            <div
              className="w-20 h-20 mb-6 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.15)',
              }}
            >
              <svg className="w-10 h-10 opacity-40" fill="none" stroke="#3B82F6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-1" style={{ color: '#64748B' }}>暂无展示内容</p>
            <p className="text-sm" style={{ color: '#475569' }}>管理员可在后台添加内容区块</p>
          </div>
        ) : (
          <div>
            {sections.map((section, idx) => (
              <div
                key={section.id}
                style={{
                  background: idx % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)',
                }}
              >
                <SectionRenderer section={section} />
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer text={config.footer_text} />
    </div>
  );
}
