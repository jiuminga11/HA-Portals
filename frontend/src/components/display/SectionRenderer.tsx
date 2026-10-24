import { useLayoutEffect, useRef } from "react";
import type { Section } from "../../types";
import { useLocale } from "../../hooks/useLocale";
import RichTextBlock from "./RichTextBlock";
import ImageGallery from "./ImageGallery";
import DataTable from "./DataTable";
import ExternalLinks from "./ExternalLinks";
import VideoPlayer from "./VideoPlayer";
import MetricCards from "./MetricCards";
import Timeline from "./Timeline";
import ProfileHero from "./ProfileHero";
import CtaBand from "./CtaBand";
import HXMark from "../common/HXMark";
import { contentLang } from "../../lib/displayContent";

interface Props {
  section: Section;
  slug?: string;
  /** §4.2 run-grouping: true for run[1..n] (consecutive same-type) — compact rhythm + title. */
  compact?: boolean;
  pageTitles?: string[];
}

/** §4.1 基础处理：type → treatment dispatch */
type Treatment = "card" | "band" | "editorial" | "split" | "table";

const TREATMENT_MAP: Record<Section["type"], Treatment> = {
  metric_cards: "band",
  rich_text: "editorial",
  timeline: "split",
  data_table: "table",
  image_gallery: "card",
  video: "card",
  external_links: "card",
  profile_hero: "card", // unreachable — hero returns early
  cta_band: "band",
};

function renderContent(section: Section, slug?: string, pageTitles: string[] = []) {
  switch (section.type) {
    case "rich_text":
      return <RichTextBlock content={section.content} headingTitles={[section.title_zh, section.title_en, ...pageTitles]} />;
    case "image_gallery":
      return <ImageGallery content={section.content} />;
    case "data_table":
      return <DataTable content={section.content} />;
    case "external_links":
      return <ExternalLinks content={section.content} />;
    case "video":
      return <VideoPlayer content={section.content} />;
    case "metric_cards":
      return <MetricCards content={section.content} />;
    case "timeline":
      return <Timeline content={section.content} isHome={slug === "home"} />;
    case "profile_hero":
      return <ProfileHero content={section.content} headingLevel={slug === "home" ? "h1" : "h2"} />;
    case "cta_band":
      return <CtaBand content={section.content} />;
    default:
      return null;
  }
}

/** Detect missing paired translations, not the language/script of their values. */
function hasEnglishContentFallback(section: Section): boolean {
  const missing = (zh: string, en: string) => Boolean(zh?.trim()) && !en?.trim();
  switch (section.type) {
    case "profile_hero": {
      const content = section.content;
      return missing(content.name_zh, content.name_en)
        || missing(content.tagline_zh, content.tagline_en)
        || missing(content.mission_zh, content.mission_en)
        || (content.cta_buttons ?? []).some(button => missing(button.label_zh, button.label_en));
    }
    case "metric_cards":
      return (section.content.cards ?? []).some(card =>
        missing(card.label_zh, card.label_en) || missing(card.detail_zh, card.detail_en));
    case "timeline":
      return (section.content.items ?? []).some(item =>
        missing(item.title_zh, item.title_en)
        || missing(item.subtitle_zh, item.subtitle_en)
        || missing(item.description_zh, item.description_en));
    case "cta_band":
      return missing(section.content.description_zh, section.content.description_en)
        || (section.content.buttons ?? []).some(button => missing(button.label_zh, button.label_en));
    default:
      return false;
  }
}

export default function SectionRenderer({ section, slug, compact = false, pageTitles = [] }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const { localized, locale, t } = useLocale();
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("visible");
      return;
    }
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const originalContent = ["rich_text", "image_gallery", "data_table", "external_links", "video"].includes(section.type);
  const originalNotice = locale === "en" && (originalContent || hasEnglishContentFallback(section))
    ? <p className="original-notice mb-5 text-sm">{t.publicPage.originalContent}</p>
    : null;

  // ProfileHero has its own full-width layout — skip the standard title wrapper
  if (section.type === "profile_hero") {
    return (
      <section ref={sectionRef} className="hero-section" id={`section-${section.id}`} style={{ scrollMarginTop: '80px' }}>
        {originalNotice && <div className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-6">{originalNotice}</div>}
        {renderContent(section, slug, pageTitles)}
      </section>
    );
  }

  const treatment = TREATMENT_MAP[section.type];
  const titleId = `section-${section.id}-title`;

  // §4.3 title spec: standard clamp(2rem, 3vw, 2.5rem); compact run[1..n] → 30px, still h2
  const titleBlock = (
    <div className={pageTitles.includes(localized(section.title_zh, section.title_en)) ? "sr-only" : "mb-8 max-w-4xl"}>
      <h2
        id={titleId}
        lang={contentLang(localized(section.title_zh, section.title_en))}
        className="font-display text-gradient"
        style={{
          fontSize: compact ? '1.875rem' : 'clamp(2rem, 3vw, 2.5rem)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        {localized(section.title_zh, section.title_en)}
      </h2>
      <HXMark variant="divider" className="mt-3 block" style={{ width: 120, height: 12 }} />
    </div>
  );

  const content = <>
    {originalNotice}
    {renderContent(section, slug, pageTitles)}
  </>;

  // Compact mobile rhythm; keep a clear section break without desktop-sized gaps.
  const rhythm = compact
    ? "pt-4 pb-10 sm:pb-16"
    : "py-10 sm:py-16";
  const gutter = "px-4 sm:px-6 lg:px-8 xl:px-10";

  const sectionProps = {
    ref: sectionRef,
    id: `section-${section.id}`,
    "aria-labelledby": titleId,
  } as const;

  if (treatment === "band") {
    return (
      <section
        {...sectionProps}
        className={`${gutter} ${rhythm}`}
        style={{
          scrollMarginTop: '80px',
          background: 'var(--section-band-bg)',
          borderTop: '1px solid var(--section-band-border)',
          borderBottom: '1px solid var(--section-band-border)',
        }}
      >
        <div className="w-full">
          {titleBlock}
          {content}
        </div>
      </section>
    );
  }

  if (treatment === "editorial") {
    // §4.4 double-layer: outer frame defines gutter/available width (section-frame
    // exposes --section-gutter), inner editorial-body clamps measure to 68ch.
    return (
      <section
        {...sectionProps}
        className={`section-frame ${gutter} ${rhythm}`}
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="editorial-body">
          {titleBlock}
          {content}
        </div>
      </section>
    );
  }

  if (treatment === "split") {
    // §4.1 split: sticky left rail (title) + right content; single column below lg
    return (
      <section
        {...sectionProps}
        className={`${gutter} ${rhythm}`}
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-12">
          <div className="lg:sticky lg:top-24 self-start">
            {titleBlock}
          </div>
          <div>{content}</div>
        </div>
      </section>
    );
  }

  if (treatment === "table") {
    return (
      <section
        {...sectionProps}
        className={`${gutter} ${rhythm}`}
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="w-full">
          {titleBlock}
          {content}
        </div>
      </section>
    );
  }

  // card: image_gallery / video / external_links keep the glass-card wrapper
  return (
    <section
      {...sectionProps}
      className={`${gutter} ${rhythm}`}
      style={{ scrollMarginTop: '80px' }}
    >
      <div className="w-full">
        <div className="glass-card rounded-2xl p-6 sm:p-8 lg:p-10 xl:p-12">
          {titleBlock}
          {content}
        </div>
      </div>
    </section>
  );
}
