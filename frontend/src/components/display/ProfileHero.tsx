import { Link } from "react-router-dom";
import type { ProfileHeroContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

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

export default function ProfileHero({ content }: Props) {
  const { localized } = useLocale();
  const {
    name_zh,
    name_en,
    tagline_zh,
    tagline_en,
    mission_zh,
    mission_en,
    social_links = [],
    cta_buttons = [],
  } = content;

  const name = localized(name_zh, name_en);
  const tagline = localized(tagline_zh, tagline_en);
  const mission = localized(mission_zh, mission_en);
  const subline = [name !== name_en ? name_en : "", tagline]
    .filter(Boolean)
    .join("  \u00b7  ");

  return (
    <div
      className="px-6"
      style={{ background: "var(--color-bg)", paddingTop: "110px", paddingBottom: "110px" }}
    >
      <div className="max-w-[760px] mx-auto text-left">
        {/* Name — serif display, single line */}
        <h1
          className="font-display"
          style={{
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: "clamp(2.75rem, 6vw, 4.25rem)",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </h1>

        {/* Romanization + tagline */}
        {subline && (
          <p
            className="mt-3"
            style={{ color: "var(--ink-4)", fontSize: "15px", letterSpacing: "0.5px" }}
          >
            {subline}
          </p>
        )}

        {/* Mission — plain body paragraph */}
        {mission && (
          <p
            className="mt-8 max-w-[680px]"
            style={{ color: "var(--ink-2)", fontSize: "20px", lineHeight: 1.7 }}
          >
            {mission}
          </p>
        )}

        {/* CTA row */}
        {cta_buttons.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10">
            {cta_buttons.map((btn, idx) => {
              const label = localized(btn.label_zh, btn.label_en);
              const isInternal = btn.url.startsWith("/") && !btn.url.startsWith("//");
              const isPrimary = idx === 0;
              const className = isPrimary
                ? "inline-flex items-center rounded-md text-sm font-semibold transition-opacity duration-200 motion-reduce:transition-none hover:opacity-90"
                : "inline-flex items-center text-sm font-medium transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70";
              const style = isPrimary
                ? { background: "var(--ink)", color: "var(--color-bg)", padding: "12px 24px" }
                : { color: "var(--accent)" };
              const inner = isPrimary ? (
                label
              ) : (
                <>
                  {label}
                  <span aria-hidden="true" className="ml-1.5">→</span>
                </>
              );
              return isInternal ? (
                <Link key={idx} to={btn.url} className={className} style={style}>
                  {inner}
                </Link>
              ) : (
                <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                  {inner}
                </a>
              );
            })}
          </div>
        )}

        {/* Social links — minimal icon row */}
        {social_links.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mt-10">
            {social_links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
                aria-label={link.label || link.platform}
                className="transition-colors duration-200 motion-reduce:transition-none"
                style={{ color: "var(--ink-4)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-4)"; }}
              >
                <SocialIcon platform={link.platform} />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
