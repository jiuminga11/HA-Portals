import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";
import { useTheme } from "../../hooks/useTheme";
import { localePath } from "../../lib/localePath";
import { getPages } from "../../api/pages";
import type { Page, SiteConfig } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";
import { useModalDialog } from "../common/useModalDialog";
import zh from "../../locales/a11y.zh.json";
import en from "../../locales/a11y.en.json";

export default function Header({ siteConfig }: { siteConfig: SiteConfig | null }) {
  const { locale, setLocale, t, localized } = useLocale();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === location.pathname;
  const [pages, setPages] = useState<Page[]>([]);
  const [navigationState, setNavigationState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [desktopFits, setDesktopFits] = useState(false);
  const labels = locale === "en" ? en : zh;
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useModalDialog(mobileOpen, menuRef, closeMenuRef, menuButtonRef);

  useEffect(() => {
    let cancelled = false;
    getPages().then(data => {
      if (!cancelled) { setPages(data.filter(page => page.visible)); setNavigationState("ready"); }
    }).catch(() => { if (!cancelled) setNavigationState("error"); });
    return () => { cancelled = true; };
  }, [attempt]);

  // Measure natural, unwrapped labels rather than guessing a page-count limit.
  // The inert measuring copy never enters keyboard or screen-reader navigation.
  useEffect(() => {
    const row = rowRef.current, measure = measureRef.current, brand = brandRef.current, controls = controlsRef.current;
    if (!row || !measure || !brand || !controls || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const fits = window.innerWidth >= 1024 && row.clientWidth >= measure.scrollWidth + brand.offsetWidth + controls.offsetWidth + 32;
      setDesktopFits(fits);
      if (fits) setMobileOpenPath(null);
    };
    const observer = new ResizeObserver(update);
    [row, measure, brand, controls].forEach(node => observer.observe(node));
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const navItems = pages.length ? pages.map(page => ({
    slug: page.slug,
    path: localePath(page.slug === "home" ? "/" : `/${page.slug}`, locale),
    label: localized(page.title_zh, page.title_en),
  })) : [{ slug: "home", path: localePath("/", locale), label: t.nav.home }];
  const isActive = (path: string) => location.pathname.replace(/\/$/, "") === path.replace(/\/$/, "");
  const retry = () => { setNavigationState("loading"); setAttempt(value => value + 1); };
  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const themeLabel = resolvedTheme === "dark" ? labels.switchToLight : labels.switchToDark;
  const navigationFeedback = navigationState === "error" ? (
    <div className="navigation-feedback flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
      <span role="alert">{labels.navigationFailed}</span>
      <button type="button" className="underline underline-offset-4" onClick={retry}>{labels.retryNavigation}</button>
    </div>
  ) : navigationState === "loading" ? <p role="status" className="sr-only">{labels.navigationLoading}</p> : null;

  return <>
    <header data-no-print className="site-header fixed top-0 left-0 right-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div ref={rowRef} className="flex items-center justify-between gap-3 h-16">
          <Link ref={brandRef} to={localePath("/", locale)} className="site-brand flex min-w-0 items-center gap-2" onClick={() => setMobileOpenPath(null)} title={siteConfig?.site_title || t.nav.home}>
            {siteConfig?.logo_url && <img src={resolveMediaUrl(siteConfig.logo_url)} alt="" className="h-9 w-9 shrink-0 object-contain" />}
            <span className="font-display font-bold tracking-tight truncate text-xl">{siteConfig?.site_title || t.nav.home}</span>
          </Link>
          <div ref={measureRef} aria-hidden="true" inert className="header-nav-measure flex gap-1">
            {navItems.map(item => <span key={item.slug} className="px-3 py-2 text-base font-medium whitespace-nowrap">{item.label}</span>)}
          </div>
          <nav aria-label={labels.navigation} className={desktopFits ? "flex items-center gap-1 shrink-0" : "hidden"}>
            {navItems.map(item => <Link key={item.slug} to={item.path} aria-current={isActive(item.path) ? "page" : undefined}
              className="public-nav-link px-3 py-2 text-base font-medium whitespace-nowrap" onClick={() => setMobileOpenPath(null)}>{item.label}</Link>)}
          </nav>
          <div ref={controlsRef} className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={toggleLocale} title={labels.switchLanguage} className="header-control px-2.5 py-2 text-xs font-bold rounded-md">{t.common.switchLanguage}</button>
            <button type="button" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} className="header-control p-2 rounded-lg">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {resolvedTheme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></> : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
              </svg>
            </button>
            <button type="button" onClick={() => setTheme("system")} aria-label={labels.useSystemTheme} aria-pressed={theme === "system"} title={labels.useSystemTheme}
              className="header-control hidden lg:inline-flex p-2 rounded-lg">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8m-4-4v4" />
              </svg>
            </button>
            <button ref={menuButtonRef} type="button" className={`header-control p-2 rounded-lg ${desktopFits ? "hidden" : ""}`}
              onClick={() => setMobileOpenPath(mobileOpen ? null : location.pathname)} aria-label={t.common.toggleMenu} aria-expanded={mobileOpen} aria-controls="mobile-navigation">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
      </div>
    </header>
    <div data-no-print className="navigation-feedback-bar relative pt-16">{navigationFeedback}</div>
    <dialog ref={menuRef} data-no-print className="mobile-navigation-dialog p-0 border-0" aria-label={labels.navigation}
      onCancel={event => { event.preventDefault(); setMobileOpenPath(null); }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) setMobileOpenPath(null);
      }}>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="font-semibold">{labels.navigation}</span>
          <button ref={closeMenuRef} type="button" className="gallery-control" aria-label={labels.closeMenu} onClick={() => setMobileOpenPath(null)}>×</button>
        </div>
        {navigationFeedback}
        <nav id="mobile-navigation" className="flex flex-col gap-2">
          {navItems.map(item => <Link key={item.slug} to={item.path} aria-current={isActive(item.path) ? "page" : undefined}
            onClick={() => setMobileOpenPath(null)} className="public-nav-link px-4 py-3 rounded-xl text-lg font-medium [overflow-wrap:anywhere]">{item.label}</Link>)}
        </nav>
        <div className="mt-5 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: "var(--hairline)" }}>
          <button type="button" className="header-control rounded-lg px-3 py-3 text-sm" onClick={toggleLocale}>{labels.switchLanguage}</button>
          <button type="button" className="header-control rounded-lg px-3 py-3 text-sm" onClick={toggleTheme}>{themeLabel}</button>
          <button type="button" className="header-control rounded-lg px-3 py-3 text-sm" onClick={() => setTheme("system")}>{labels.useSystemTheme}</button>
        </div>
      </div>
    </dialog>
  </>;
}
