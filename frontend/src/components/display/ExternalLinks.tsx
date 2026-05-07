import type { ExternalLinksContent } from "../../types";

interface Props {
  content: ExternalLinksContent;
}

export default function ExternalLinks({ content }: Props) {
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p>暂无内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
          style={{
            borderRadius: '12px',
            padding: '16px 20px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            transition: 'all 0.25s ease',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.borderColor = 'var(--border-glow)';
            el.style.background = 'var(--hover-bg)';
            el.style.boxShadow = '0 4px 16px var(--glow-primary), 0 2px 8px rgba(0,0,0,0.06)';
            el.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.borderColor = 'var(--card-border)';
            el.style.background = 'var(--card-bg)';
            el.style.boxShadow = '';
            el.style.transform = '';
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Link icon indicator */}
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                style={{
                  background: 'var(--badge-bg)',
                  border: '1px solid var(--card-border)',
                  transition: 'all 0.25s ease',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="#60A5FA" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  className="text-lg font-medium leading-snug transition-colors duration-200"
                  style={{ color: 'var(--text-base)' }}
                >
                  {item.title}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {item.source && (
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        background: 'var(--badge-bg)',
                        border: '1px solid var(--card-border)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {item.source}
                    </span>
                  )}
                  {item.date && (
                    <span
                      className="text-sm flex items-center gap-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {item.date}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Arrow icon */}
            <div
              className="shrink-0 mt-1 transition-all duration-200"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
