import { Link } from "react-router-dom";
import type { ProfileHeroContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  content: ProfileHeroContent;
}

/** Map platform names to simple SVG icons */
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();

  if (p === 'email' || p === 'mail') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (p === 'github') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    );
  }
  if (p === 'scholar' || p === 'google scholar') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 100 14 7 7 0 000-14z" />
      </svg>
    );
  }
  if (p === 'orcid') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 01-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-1.547-.956-3.722-3.916-3.722h-2.403z" />
      </svg>
    );
  }
  if (p === 'researchgate') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.586 0c-1.598 0-2.897 1.3-2.897 2.898 0 1.597 1.299 2.896 2.897 2.896s2.896-1.299 2.896-2.896C22.482 1.3 21.184 0 19.586 0zM3.008 7.062C1.346 7.062 0 8.408 0 10.07c0 1.662 1.346 3.008 3.008 3.008 1.662 0 3.008-1.346 3.008-3.008 0-1.662-1.346-3.008-3.008-3.008zm0 16.938C1.346 24 0 22.654 0 20.992V14.93c0-1.662 1.346-3.008 3.008-3.008 1.662 0 3.008 1.346 3.008 3.008v6.062C6.016 22.654 4.67 24 3.008 24zm16.578-16.938H10.07c-1.662 0-3.008 1.346-3.008 3.008v6.062c0 1.662 1.346 3.008 3.008 3.008h3.008c1.662 0 3.008-1.346 3.008-3.008 0-1.662-1.346-3.008-3.008-3.008H10.07v-2.054h9.516c1.662 0 3.008-1.346 3.008-3.008z" />
      </svg>
    );
  }
  // Generic link icon
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

/** Extract initials from name for avatar placeholder */
function getInitials(nameZh: string, nameEn: string): string {
  if (nameEn) {
    return nameEn
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  // For Chinese names, take last 1-2 characters (given name)
  return nameZh.slice(-2);
}

export default function ProfileHero({ content }: Props) {
  const { localized } = useLocale();
  const {
    avatar_url,
    name_zh,
    name_en,
    tagline_zh,
    tagline_en,
    mission_zh,
    mission_en,
    tags = [],
    social_links = [],
    cta_buttons = [],
  } = content;

  const name = localized(name_zh, name_en);
  const tagline = localized(tagline_zh, tagline_en);
  const mission = localized(mission_zh, mission_en);

  return (
    <div className="flex flex-col items-center text-center py-20 sm:py-28 px-6">
      {/* Avatar */}
      <div className="mb-8">
        {avatar_url ? (
          <img
            src={resolveMediaUrl(avatar_url)}
            alt={name}
            className="w-32 h-32 rounded-full object-cover"
            style={{
              border: '3px solid var(--color-primary)',
              boxShadow: '0 0 24px var(--glow-primary)',
            }}
          />
        ) : (
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{
              background: 'var(--bg-elevated)',
              border: '3px solid var(--color-primary)',
              color: 'var(--color-primary)',
              boxShadow: '0 0 24px var(--glow-primary)',
            }}
          >
            {getInitials(name_zh, name_en)}
          </div>
        )}
      </div>

      {/* Name */}
      <h1
        className="text-4xl sm:text-5xl font-bold font-display mb-4"
        style={{ color: 'var(--text-base)' }}
      >
        {name}
      </h1>

      {/* Tagline */}
      {tagline && (
        <p
          className="text-xl sm:text-2xl mb-6 max-w-2xl"
          style={{ color: 'var(--text-muted)' }}
        >
          {tagline}
        </p>
      )}

      {/* Mission quote */}
      {mission && (
        <blockquote
          className="text-base sm:text-lg italic max-w-xl mb-8 leading-relaxed"
          style={{
            color: 'var(--text-muted)',
            borderLeft: '3px solid var(--color-primary)',
            paddingLeft: '1rem',
            textAlign: 'left',
          }}
        >
          {mission}
        </blockquote>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-sm font-medium px-3 py-1 rounded-full"
              style={{
                background: 'var(--badge-bg)',
                color: 'var(--color-primary)',
                border: '1px solid var(--border-glow)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Social links */}
      {social_links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {social_links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = 'var(--badge-bg)';
                el.style.borderColor = 'var(--border-glow)';
                el.style.color = 'var(--color-primary)';
                el.style.boxShadow = '0 0 12px var(--glow-primary)';
                el.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = 'var(--bg-elevated)';
                el.style.borderColor = 'var(--card-border)';
                el.style.color = 'var(--text-muted)';
                el.style.boxShadow = '';
                el.style.transform = '';
              }}
            >
              <SocialIcon platform={link.platform} />
            </a>
          ))}
        </div>
      )}

      {/* CTA buttons */}
      {cta_buttons.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {cta_buttons.map((btn, idx) => {
            const label = localized(btn.label_zh, btn.label_en);
            const isPrimary = idx === 0;
            const isInternal = btn.url.startsWith("/") && !btn.url.startsWith("//");

            const className = isPrimary
              ? "btn-gradient px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300"
              : "px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300";

            const secondaryStyle = !isPrimary ? {
              background: 'var(--bg-elevated)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-base)',
            } : undefined;

            const hoverHandlers = !isPrimary ? {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
                const el = e.currentTarget;
                el.style.borderColor = 'var(--border-glow)';
                el.style.boxShadow = '0 4px 15px var(--glow-primary)';
                el.style.transform = 'translateY(-1px)';
              },
              onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
                const el = e.currentTarget;
                el.style.borderColor = 'var(--card-border)';
                el.style.boxShadow = '';
                el.style.transform = '';
              },
            } : {};

            return isInternal ? (
              <Link key={idx} to={btn.url} className={className} style={secondaryStyle} {...hoverHandlers}>
                {label}
              </Link>
            ) : (
              <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer" className={className} style={secondaryStyle} {...hoverHandlers}>
                {label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
