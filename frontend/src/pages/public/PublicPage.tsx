import { useEffect, useState } from "react";
import type { Page, Section } from "../../types";
import { getPageBySlug, getPageSections } from "../../api/pages";
import SectionRenderer from "../../components/display/SectionRenderer";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  slug: string;
}

export default function PublicPage({ slug }: Props) {
  const [page, setPage] = useState<Page | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, localized } = useLocale();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [pageData, secs] = await Promise.all([
          getPageBySlug(slug),
          getPageSections(slug),
        ]);
        if (cancelled) return;
        setPage(pageData);
        setSections(secs.filter((s) => s.visible));
        document.title = localized(pageData.title_zh, pageData.title_en);
      } catch {
        if (!cancelled) {
          setError(t.common.error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, localized, t.common.error]);

  if (loading) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center tech-bg"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-center glass-card rounded-2xl px-10 py-12">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div
              className="absolute inset-0 rounded-full border-2 animate-spin"
              style={{ borderColor: "transparent", borderTopColor: "var(--color-primary)" }}
            />
            <div
              className="absolute inset-2 rounded-full border-2 animate-spin"
              style={{
                borderColor: "transparent",
                borderTopColor: "var(--color-gradient)",
                animationDirection: "reverse",
                animationDuration: "0.8s",
              }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t.common.loading}
          </p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center tech-bg"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-center glass-card rounded-2xl px-10 py-12">
          <div
            className="w-16 h-16 mb-4 mx-auto rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(var(--color-highlight-rgb), 0.08)",
              border: "1px solid rgba(var(--color-highlight-rgb), 0.15)",
            }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              style={{ color: "var(--color-highlight)" }}
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium" style={{ color: "var(--text-muted)" }}>
            {error || t.common.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tech-bg" style={{ background: "var(--color-bg)" }}>
      {sections.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-32"
          style={{ color: "var(--text-muted)" }}
        >
          <div
            className="w-20 h-20 mb-6 rounded-2xl flex items-center justify-center glass-card"
          >
            <svg
              className="w-10 h-10 opacity-40"
              fill="none"
              stroke="var(--color-primary)"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
        </div>
      ) : (
        <div>
          {sections.map((section, idx) => (
            <SectionRenderer
              key={section.id}
              section={section}
              slug={slug}
              compact={idx > 0 && sections[idx - 1].type === section.type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
