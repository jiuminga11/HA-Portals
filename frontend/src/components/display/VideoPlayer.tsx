import type { VideoContent } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: VideoContent;
}

export default function VideoPlayer({ content }: Props) {
  const { items = [] } = content;
  const { t } = useLocale();

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p>{t.section.noVideos}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="overflow-hidden glass-card rounded-2xl transition-all duration-300"
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--border-glow)';
            el.style.boxShadow = '0 4px 20px var(--glow-primary), 0 8px 24px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = '';
            el.style.boxShadow = '';
          }}
        >
          {/* Video container */}
          <div
            className="relative aspect-video"
            style={{ background: 'var(--color-bg)' }}
          >
            <video
              className="w-full h-full object-contain"
              controls
              preload="metadata"
              poster={item.poster ? resolveMediaUrl(item.poster) : undefined}
              style={{ display: 'block' }}
            >
              <source src={resolveMediaUrl(item.url)} />
              {t.section.videoNotSupported}
            </video>
          </div>

          {/* Title bar */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--card-border)' }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--color-accent)', boxShadow: '0 0 6px var(--color-accent)' }}
            />
            <h3
              className="text-base font-medium truncate"
              style={{ color: 'var(--text-base)' }}
            >
              {item.title}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
