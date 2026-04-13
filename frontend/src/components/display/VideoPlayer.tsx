import type { VideoContent } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  content: VideoContent;
}

export default function VideoPlayer({ content }: Props) {
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="#3B82F6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p>暂无视频</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="overflow-hidden"
          style={{
            borderRadius: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--card-shadow)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--border-glow)';
            el.style.boxShadow = '0 4px 20px var(--glow-primary), 0 8px 24px rgba(0,0,0,0.08)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--card-border)';
            el.style.boxShadow = 'var(--card-shadow)';
          }}
        >
          {/* Video container */}
          <div
            className="relative aspect-video"
            style={{ background: '#000' }}
          >
            <video
              className="w-full h-full object-contain"
              controls
              preload="metadata"
              poster={item.poster ? resolveMediaUrl(item.poster) : undefined}
              style={{ display: 'block' }}
            >
              <source src={resolveMediaUrl(item.url)} />
              您的浏览器不支持视频播放
            </video>
          </div>

          {/* Title bar */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--card-border)' }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: '#06B6D4', boxShadow: '0 0 6px #06B6D4' }}
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
