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

interface Props {
  section: Section;
  slug?: string;
  /** §4.2 run-grouping: true for run[1..n] (consecutive same-type) — compact rhythm + title. */
  compact?: boolean;
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

function renderContent(section: Section, slug?: string) {
  switch (section.type) {
    case "rich_text":
      return <RichTextBlock content={section.content} />;
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
      return <ProfileHero content={section.content} />;
    case "cta_band":
      return <CtaBand content={section.content} />;
    default:
      return null;
  }
}

export default function SectionRenderer({ section, slug, compact = false }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const { localized } = useLocale();
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

  // ProfileHero has its own full-width layout — skip the standard title wrapper
  if (section.type === "profile_hero") {
    return (
      <section ref={sectionRef} className="hero-section" id={`section-${section.id}`} style={{ scrollMarginTop: '80px' }}>
        {renderContent(section, slug)}
      </section>
    );
  }

  const treatment = TREATMENT_MAP[section.type];
  const titleId = `section-${section.id}-title`;

  // §4.3 title spec: standard clamp(2rem, 3vw, 2.5rem); compact run[1..n] → 30px, still h2
  const titleBlock = (
    <div className="mb-8 max-w-4xl">
      <h2
        id={titleId}
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

  const content = renderContent(section, slug);

  // Vertical rhythm: standard py-20; compact pt-4 pb-20.
  // Band halves mobile padding (§8): py-10 below sm.
  const rhythm = compact
    ? treatment === "band" ? "pt-4 pb-10 sm:pb-20" : "pt-4 pb-20"
    : treatment === "band" ? "py-10 sm:py-20" : "py-20";
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
