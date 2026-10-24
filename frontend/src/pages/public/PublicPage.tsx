import { Fragment, useEffect, useLayoutEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { Page, Section } from "../../types";
import type { PublicPageContext } from "../../components/layout/PublicLayout";
import { basePath, resolveMediaUrl } from "../../lib/basePath";
import { localePath } from "../../lib/localePath";
import SectionRenderer from "../../components/display/SectionRenderer";
import { useLocale } from "../../hooks/useLocale";
import { contentLang } from "../../lib/displayContent";

interface Props { slug: string }

function resolveOgImage(value: string | null | undefined, origin: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(resolveMediaUrl(value), origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    // Invalid legacy configuration must not interrupt rendering or other metadata.
    return undefined;
  }
}

export default function PublicPage({ slug }: Props) {
  const [page, setPage] = useState<Page | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"notFound" | "networkError" | "timeout" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [settledSlug, setSettledSlug] = useState<string | null>(null);
  const { t, localized, locale } = useLocale();
  const context = useOutletContext<PublicPageContext | undefined>();
  const siteConfig = context?.siteConfig;
  const onPageReady = context?.onPageReady;

  useEffect(() => {
    if (!loading && settledSlug === slug && (error || page?.slug === slug)) return onPageReady?.();
  }, [loading, error, page, slug, settledSlug, onPageReady]);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    async function fetchPublic<T>(url: string): Promise<T> {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw response;
      return response.json();
    }
    async function load() {
      setLoading(true);
      setError(null);
      setPage(null);
      setSections([]);
      if (!slug) {
        setError("notFound");
        setLoading(false);
        setSettledSlug(slug);
        window.clearTimeout(timeout);
        return;
      }
      try {
        const [pageData, secs] = await Promise.all([
          fetchPublic<Page>(`${basePath}/api/pages/${encodeURIComponent(slug)}`),
          fetchPublic<Section[]>(`${basePath}/api/pages/${encodeURIComponent(slug)}/sections`),
        ]);
        if (cancelled) return;
        if (!pageData.visible) { setError("notFound"); return; }
        setPage(pageData);
        setSections(secs.filter((section) => section.visible).sort((a, b) => a.sort_order - b.sort_order));
      } catch (err) {
        if (!cancelled) setError(err instanceof Response && err.status === 404 ? "notFound" : timedOut ? "timeout" : "networkError");
      } finally {
        window.clearTimeout(timeout);
        controller.abort();
        if (!cancelled) { setLoading(false); setSettledSlug(slug); }
      }
    }
    void load();
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort(); };
  }, [slug, attempt]);

  useLayoutEffect(() => {
    // Clear previous-route metadata before paint, including static initial tags.
    const clear = () => document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[property^="og:"]').forEach(node => node.remove());
    clear();
    const setMeta = (key: string, value: string, property = false) => {
      if (!value) return;
      const element = document.createElement("meta");
      element.setAttribute(property ? "property" : "name", key);
      element.content = value;
      document.head.appendChild(element);
    };
    const validPage = page?.slug === slug && !loading && !error;
    if (!validPage || !page) {
      document.title = error ? (error === "notFound" ? t.publicPage.notFoundTitle : t.publicPage.errorTitle) : t.common.loading;
      if (error) setMeta("robots", "noindex, nofollow");
      return clear;
    }
    const title = localized(page.title_zh, page.title_en)
      || localized(siteConfig?.seo_default_title_zh || "", siteConfig?.seo_default_title_en || "")
      || siteConfig?.site_title || t.nav.home;
    const description = localized(page.meta_description_zh, page.meta_description_en)
      || localized(siteConfig?.seo_default_description_zh || "", siteConfig?.seo_default_description_en || "");
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", "website", true);
    const url = new URL(window.location.href); url.hash = "";
    setMeta("og:url", url.href, true);
    if (siteConfig?.site_title) setMeta("og:site_name", siteConfig.site_title, true);
    const ogImage = resolveOgImage(siteConfig?.seo_og_image, window.location.origin);
    if (ogImage) setMeta("og:image", ogImage, true);
    return clear;
  }, [page, slug, loading, error, siteConfig, localized, t]);

  // Do not show the previous page's sections while a new route begins loading.
  if (loading || (page && page.slug !== slug)) return (
    <div role="status" className="public-state min-h-[60vh] px-4 py-24 text-center">
      <div aria-hidden="true" className="mx-auto mb-5 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin motion-reduce:animate-none" />
      <p>{t.common.loading}</p>
    </div>
  );

  if (error || !page) return (
    <div className="public-state min-h-[60vh] px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold mb-4">{error === "notFound" ? t.publicPage.notFoundTitle : t.publicPage.errorTitle}</h1>
      <p role="alert" className="reading-muted max-w-xl mx-auto mb-6">{t.publicPage[error || "networkError"]}</p>
      {error !== "notFound" && <button className="public-action rounded-lg px-5 py-3 font-medium" onClick={() => setAttempt((value) => value + 1)}>{t.publicPage.retry}</button>}
      <Link className="inline-block mx-3 mt-4 underline underline-offset-4" to={localePath("/", locale)}>{t.publicPage.returnHome}</Link>
    </div>
  );

  const title = localized(page.title_zh, page.title_en);
  const firstHero = sections.findIndex(section => section.type === "profile_hero");
  const homeIntroduction = slug === "home" && (siteConfig?.project_title || siteConfig?.banner_url) ? (
    <div className="relative px-4 sm:px-6 lg:px-8 xl:px-10 pt-8">
      {siteConfig.project_title && <p lang={contentLang(siteConfig.project_title)} className="reading-muted text-lg whitespace-pre-wrap [overflow-wrap:anywhere]">{siteConfig.project_title}</p>}
      {siteConfig.banner_url && <img className="mt-5 w-full max-h-[28rem] object-contain rounded-xl" src={resolveMediaUrl(siteConfig.banner_url)} alt={siteConfig.project_title || siteConfig.site_title || ""} />}
    </div>
  ) : null;
  return (
    <div className="public-page tech-bg">
      {(slug !== "home" || firstHero === -1) && <header className="relative px-4 sm:px-6 lg:px-8 xl:px-10 pt-12 sm:pt-16 pb-4">
        <h1 lang={contentLang(title)} className="page-heading font-display text-4xl sm:text-5xl font-bold [overflow-wrap:anywhere]">{title}</h1>
        {slug === "research" && sections.length > 0 && <nav aria-label={t.publicPage.onThisPage} className="section-nav mt-8 rounded-xl p-4 sm:p-5">
          <p className="reading-muted text-sm mb-3">{t.publicPage.onThisPage}</p>
          <ul className="flex flex-wrap gap-2 sm:gap-3">
            {sections.map((section) => <li key={section.id} className="min-w-0 max-w-full">
              <a lang={contentLang(localized(section.title_zh, section.title_en))} className="inline-block rounded-md px-3 py-2 underline underline-offset-4 [overflow-wrap:anywhere]" href={`#section-${section.id}`}>{localized(section.title_zh, section.title_en)}</a>
            </li>)}
          </ul>
        </nav>}
      </header>}
      {firstHero === -1 && homeIntroduction}
      {sections.length === 0 ? <div role="status" className="public-state px-4 py-24 text-center"><p>{t.publicPage.empty}</p></div> : sections.map((section, index) => (
        <Fragment key={section.id}>
          <SectionRenderer section={section} slug={section.type === "profile_hero" && index !== firstHero ? undefined : slug} pageTitles={slug === "home" ? [] : [page.title_zh, page.title_en]} compact={index > 0 && sections[index - 1].type === section.type} />
          {index === firstHero && homeIntroduction}
        </Fragment>
      ))}
    </div>
  );
}
