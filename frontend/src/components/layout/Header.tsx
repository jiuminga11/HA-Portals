import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";
import { useTheme } from "../../hooks/useTheme";
import { getPages } from "../../api/pages";
import type { Page, SiteConfig } from "../../types";

interface Props {
  siteConfig: SiteConfig | null;
}

export default function Header({ siteConfig }: Props) {
  const { locale, setLocale, t, localized } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);

  // Load pages for navigation
  useEffect(() => {
    getPages().then(setPages).catch((err) => console.warn("[HA-PORTALS] Failed to load pages:", err.message));
  }, []);

  // Track scroll for backdrop effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh" ? "en" : "zh");
  }, [locale, setLocale]);

  // Build nav items from pages: home → "/", others → "/{slug}"
  const navItems = pages.map((page) => ({
    slug: page.slug,
    path: page.slug === "home" ? "/" : `/${page.slug}`,
    label: localized(page.title_zh, page.title_en),
  }));

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path;
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "var(--nav-bg)" : "transparent",
          backdropFilter: scrolled ? "blur(24px) saturate(180%)" : undefined,
          WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : undefined,
          borderBottom: scrolled ? "1px solid var(--nav-border)" : "1px solid transparent",
          boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.06)" : undefined,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: site name */}
            <Link to="/" className="flex items-center gap-3 group">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-transform duration-200 motion-reduce:transition-none group-hover:-translate-y-0.5 motion-reduce:transform-none"
                style={{
                  background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 12px rgba(var(--color-primary-rgb), 0.25)",
                }}
              >
                {siteConfig?.site_title?.slice(0, 2).toUpperCase() || "HP"}
              </span>
              <span
                className="hidden sm:block font-display font-semibold tracking-tight text-base"
                style={{ color: "var(--text-base)" }}
              >
                {siteConfig?.site_title || "Hu Xing"}
              </span>
            </Link>

            {/* Center: desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.slug}
                    to={item.path}
                    className="relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = "var(--text-base)";
                        e.currentTarget.style.background = "var(--hover-bg)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {item.label}
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                        style={{
                          background: "linear-gradient(90deg, var(--color-primary), var(--color-gradient))",
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: controls */}
            <div className="flex items-center gap-1">
              {/* Language toggle */}
              <button
                onClick={toggleLocale}
                className="px-2.5 py-1.5 text-xs font-bold rounded-md transition-all duration-200"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-glass)",
                  background: "var(--bg-surface)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary)";
                  e.currentTarget.style.color = "var(--color-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-glass)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
                title={t.common.language}
              >
                {locale === "zh" ? "EN" : "中"}
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-all duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-base)";
                  e.currentTarget.style.background = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
                title={t.common.theme}
              >
                {resolvedTheme === "dark" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-lg transition-all duration-200"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />

          {/* Menu panel */}
          <div
            className="absolute top-16 left-0 right-0 bottom-0 overflow-y-auto"
            style={{ background: "var(--bg-base)" }}
          >
            <nav className="flex flex-col px-6 py-8 gap-2">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.slug}
                    to={item.path}
                    className="px-4 py-3 rounded-xl text-lg font-medium transition-all duration-200"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--text-base)",
                      background: active ? "var(--hover-bg)" : "transparent",
                      borderLeft: active
                        ? "3px solid var(--color-primary)"
                        : "3px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
