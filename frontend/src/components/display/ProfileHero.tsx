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
    <div className="relative overflow-hidden px-6 py-20 sm:py-24 lg:py-32">
      {/* Background ambient lights — theme-driven */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 18% 25%, rgba(var(--color-primary-rgb), 0.14), transparent 35%), " +
            "radial-gradient(circle at 82% 30%, rgba(var(--color-accent-rgb), 0.12), transparent 32%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-16 items-center">
        {/* Left column: narrative */}
        <div className="text-left order-2 lg:order-1">
          {/* Decorative gradient line — academic minimal */}
          <div
            className="mb-5 h-px w-12"
            style={{
              background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            }}
          />

          {/* Name — serif display */}
          <h1
            className="font-display font-semibold tracking-tight leading-[0.95] text-5xl sm:text-6xl lg:text-7xl mb-6"
            style={{ color: "var(--text-base)" }}
          >
            {name}
          </h1>

          {tagline && (
            <p
              className="text-xl sm:text-2xl mb-6 leading-relaxed max-w-xl"
              style={{ color: "var(--text-base)", opacity: 0.85 }}
            >
              {tagline}
            </p>
          )}

          {mission && (
            <blockquote
              className="text-base sm:text-lg italic max-w-xl mb-8 leading-relaxed font-display"
              style={{
                color: "var(--text-muted)",
                borderLeft: "3px solid var(--color-primary)",
                paddingLeft: "1rem",
              }}
            >
              {mission}
            </blockquote>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full"
                  style={{
                    background: "rgba(var(--color-primary-rgb), 0.10)",
                    color: "var(--color-primary)",
                    border: "1px solid rgba(var(--color-primary-rgb), 0.25)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {cta_buttons.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {cta_buttons.map((btn, idx) => {
                const label = localized(btn.label_zh, btn.label_en);
                const isPrimary = idx === 0;
                const isInternal = btn.url.startsWith("/") && !btn.url.startsWith("//");

                const className = isPrimary
                  ? "btn-gradient px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:transform-none"
                  : "px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:transform-none";

            const secondaryStyle = !isPrimary ? {
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--card-border)",
                      color: "var(--text-base)",
            } : undefined;

                return isInternal ? (
                  <Link key={idx} to={btn.url} className={className} style={secondaryStyle}>
                    {label}
                  </Link>
                ) : (
                  <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer" className={className} style={secondaryStyle}>
                    {label}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: identity card */}
        <div className="flex flex-col items-center lg:items-end order-1 lg:order-2">
          <div className="relative">
            {/* Soft glow backdrop */}
            <div
              className="absolute -inset-1 rounded-full opacity-60 motion-reduce:hidden"
              aria-hidden="true"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                filter: "blur(12px)",
              }}
            />
            {avatar_url ? (
              <img
                src={resolveMediaUrl(avatar_url)}
                alt={name}
                className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full object-cover"
                style={{
                  border: "4px solid var(--bg-base)",
                  boxShadow: "0 12px 40px rgba(var(--color-primary-rgb), 0.25)",
                }}
              />
            ) : (
              <div
                className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex items-center justify-center text-5xl font-display font-bold"
                style={{
                  background: "var(--bg-elevated)",
                  border: "4px solid var(--bg-base)",
                  color: "var(--color-primary)",
                  boxShadow: "0 12px 40px rgba(var(--color-primary-rgb), 0.25)",
                }}
              >
                {getInitials(name_zh, name_en)}
              </div>
            )}
          </div>

          {/* Social links — pure CSS hover (C-6 fix) */}
          {social_links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {social_links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  aria-label={link.label || link.platform}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:transform-none social-link"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-muted)",
                  }}
                >
                  <SocialIcon platform={link.platform} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
