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

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1 && /[a-zA-Z]/.test(parts[0][0])) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

/** Large abstract SVG: neural-network / code-node constellation */
function TechVisual() {
  return (
    <div className="relative w-full aspect-square max-w-[640px] mx-auto lg:mx-0 lg:ml-auto">
      <svg
        className="w-full h-full"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tech-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="tech-node" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
          <radialGradient id="tech-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft background glow */}
        <circle cx="200" cy="200" r="160" fill="url(#tech-glow)" />

        {/* Connection lines */}
        <g stroke="url(#tech-line)" strokeWidth="1.2" opacity="0.7">
          <line x1="80" y1="120" x2="160" y2="170" />
          <line x1="160" y1="170" x2="260" y2="130" />
          <line x1="260" y1="130" x2="320" y2="200" />
          <line x1="320" y1="200" x2="260" y2="290" />
          <line x1="260" y1="290" x2="160" y2="250" />
          <line x1="160" y1="250" x2="80" y2="120" />
          <line x1="160" y1="170" x2="160" y2="250" />
          <line x1="260" y1="130" x2="260" y2="290" />
          <line x1="80" y1="120" x2="200" y2="80" />
          <line x1="200" y1="80" x2="320" y2="200" />
          <line x1="200" y1="80" x2="260" y2="130" />
          <line x1="200" y1="80" x2="160" y2="170" />
          <line x1="80" y1="120" x2="120" y2="300" />
          <line x1="120" y1="300" x2="260" y2="290" />
          <line x1="120" y1="300" x2="160" y2="250" />
        </g>

        {/* Grid rings */}
        <g stroke="var(--color-primary)" strokeWidth="0.8" strokeOpacity="0.18">
          <circle cx="200" cy="200" r="60" />
          <circle cx="200" cy="200" r="110" />
          <circle cx="200" cy="200" r="155" />
        </g>

        {/* Nodes */}
        <g fill="var(--color-bg-card)" stroke="url(#tech-node)" strokeWidth="2">
          <circle cx="80" cy="120" r="8" />
          <circle cx="200" cy="80" r="10" />
          <circle cx="320" cy="200" r="9" />
          <circle cx="260" cy="130" r="7" />
          <circle cx="160" cy="170" r="7" />
          <circle cx="160" cy="250" r="8" />
          <circle cx="260" cy="290" r="7" />
          <circle cx="120" cy="300" r="6" />
        </g>

        {/* Inner node cores */}
        <g fill="url(#tech-node)">
          <circle cx="200" cy="200" r="14" />
          <circle cx="200" cy="200" r="6" fill="var(--color-bg-card)" />
        </g>

        {/* Floating accent dots */}
        <g fill="var(--color-accent)" fillOpacity="0.65">
          <circle cx="140" cy="110" r="3" />
          <circle cx="290" cy="100" r="2.5" />
          <circle cx="340" cy="260" r="3" />
          <circle cx="100" cy="340" r="2.5" />
          <circle cx="240" cy="340" r="2" />
        </g>
      </svg>
    </div>
  );
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
  const subline = [name !== name_en ? name_en : "", tagline]
    .filter(Boolean)
    .join("  \u00b7  ");
  const initials = getInitials(name);

  return (
    <div
      className="relative overflow-hidden tech-bg"
      style={{ backgroundColor: "var(--color-bg)", paddingTop: "120px", paddingBottom: "120px" }}
    >
      {/* Extra floating orbs for depth */}
      <div
        className="bg-orb bg-orb-1"
        style={{
          width: "520px",
          height: "520px",
          top: "-180px",
          right: "-120px",
          background: "radial-gradient(circle, rgba(var(--color-primary-rgb), 0.09) 0%, transparent 70%)",
        }}
      />
      <div
        className="bg-orb bg-orb-2"
        style={{
          width: "380px",
          height: "380px",
          bottom: "-100px",
          left: "-100px",
          background: "radial-gradient(circle, rgba(var(--color-accent-rgb), 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text content */}
          <div className="order-2 lg:order-1 text-left">
            {/* Avatar */}
            <div
              className="w-[96px] h-[96px] lg:w-[112px] lg:h-[112px] rounded-full p-[3px] mb-8 bg-gradient-primary"
              style={{ boxShadow: "0 12px 40px rgba(var(--color-primary-rgb), 0.22)" }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                style={{ background: "var(--color-bg-card)" }}
              >
                {avatar_url ? (
                  <img
                    src={avatar_url}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="font-display font-bold text-gradient"
                    style={{ fontSize: "2.5rem", letterSpacing: "-0.02em" }}
                  >
                    {initials || "?"}
                  </span>
                )}
              </div>
            </div>

            {/* Name */}
            <h1
              className="font-display"
              style={{
                color: "var(--ink)",
                fontWeight: 700,
                fontSize: "clamp(3.2rem, 7vw, 5.25rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {name}
            </h1>

            {/* Romanization + tagline */}
            {subline && (
              <p
                className="mt-4"
                style={{ color: "var(--ink-3)", fontSize: "20px", letterSpacing: "0.5px" }}
              >
                {subline}
              </p>
            )}

            {/* Mission */}
            {mission && (
              <p
                className="mt-8 lg:mt-10 lg:max-w-[720px]"
                style={{ color: "var(--ink-2)", fontSize: "24px", lineHeight: 1.7 }}
              >
                {mission}
              </p>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-8">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-4 py-1.5 rounded-full text-base font-medium"
                    style={{
                      background: "var(--badge-bg)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--border-glow)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* CTA row */}
            {cta_buttons.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10">
                {cta_buttons.map((btn, idx) => {
                  const label = localized(btn.label_zh, btn.label_en);
                  const isInternal = btn.url.startsWith("/") && !btn.url.startsWith("//");
                  const isPrimary = idx === 0;
                  const className = isPrimary
                    ? "inline-flex items-center rounded-md text-lg font-semibold transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5"
                    : "inline-flex items-center rounded-md text-lg font-medium transition-all duration-200 motion-reduce:transition-none hover-bg px-3 py-2";
                  const style = isPrimary
                    ? {
                        background: "linear-gradient(135deg, var(--color-primary), var(--color-gradient))",
                        color: "var(--color-bg)",
                        padding: "14px 28px",
                        boxShadow: "0 8px 28px rgba(var(--color-primary-rgb), 0.28)",
                      }
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

            {/* Social links */}
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
                    className="social-link w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 motion-reduce:transition-none"
                  >
                    <SocialIcon platform={link.platform} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Right: abstract tech visual */}
          <div className="order-1 lg:order-2 flex items-center justify-center">
            <TechVisual />
          </div>
        </div>
      </div>

      {/* Bottom transition line */}
      <div className="gradient-line absolute bottom-0 left-0 right-0" />
    </div>
  );
}
