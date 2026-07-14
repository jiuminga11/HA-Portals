import { useEffect, useRef } from "react";
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

interface Props {
  section: Section;
}

function renderContent(section: Section) {
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
      return <Timeline content={section.content} />;
    case "profile_hero":
      return <ProfileHero content={section.content} />;
    default:
      return null;
  }
}

export default function SectionRenderer({ section }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const { localized } = useLocale();
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

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
      <section ref={sectionRef} className="reveal" id={`section-${section.id}`} style={{ scrollMarginTop: '80px' }}>
        {renderContent(section)}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="reveal px-4 sm:px-6"
      id={`section-${section.id}`}
      style={{ scrollMarginTop: '80px', paddingTop: '90px', paddingBottom: '90px' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 max-w-3xl">
          <h2
            className="font-display"
            style={{ color: 'var(--ink)', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            {localized(section.title_zh, section.title_en)}
          </h2>
        </div>

        {renderContent(section)}
      </div>
    </section>
  );
}
