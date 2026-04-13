import type { SiteConfig } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  siteConfig: SiteConfig;
}

function getDisplayConfig(config: SiteConfig) {
  return {
    ...config,
    displayTitle: config.site_title?.trim() || "",
    displayProject: config.project_title?.trim() || "请在后台设置项目名称",
    showLogo: !!config.logo_url,
    showBanner: !!config.banner_url,
    showFooterText: !!config.footer_text?.trim(),
  };
}

export default function Header({ siteConfig }: Props) {
  const display = getDisplayConfig(siteConfig);

  return (
    <header className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0C1E4A 0%, #1E3A8A 35%, #1D4ED8 70%, #2563EB 100%)' }}>
      {/* Multi-layer background effects */}

      {/* Layer 1: Tech grid */}
      <div className="absolute inset-0 tech-grid pointer-events-none" style={{ opacity: 0.5 }} />

      {/* Layer 2: Diagonal light streaks */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(125deg, transparent 30%, rgba(59,130,246,0.08) 45%, transparent 55%),
            linear-gradient(235deg, transparent 40%, rgba(96,165,250,0.06) 55%, transparent 65%),
            linear-gradient(170deg, transparent 60%, rgba(37,99,235,0.1) 75%, transparent 85%)
          `,
        }}
      />

      {/* Layer 3: Neural network nodes (decorative dots) */}
      <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
        {/* Cluster top-right */}
        <div className="absolute" style={{ top: '15%', right: '12%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(147,197,253,0.5)', boxShadow: '0 0 12px rgba(147,197,253,0.4)' }} />
        <div className="absolute" style={{ top: '22%', right: '18%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(147,197,253,0.35)' }} />
        <div className="absolute" style={{ top: '12%', right: '22%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(96,165,250,0.4)', boxShadow: '0 0 8px rgba(96,165,250,0.3)' }} />
        {/* Connection lines */}
        <svg className="absolute" style={{ top: '10%', right: '8%', width: '20%', height: '30%', opacity: 0.15 }}>
          <line x1="60%" y1="30%" x2="80%" y2="55%" stroke="#93C5FD" strokeWidth="1" />
          <line x1="80%" y1="55%" x2="50%" y2="70%" stroke="#93C5FD" strokeWidth="1" />
          <line x1="40%" y1="20%" x2="60%" y2="30%" stroke="#60A5FA" strokeWidth="1" />
          <line x1="60%" y1="30%" x2="50%" y2="70%" stroke="#93C5FD" strokeWidth="0.5" />
        </svg>

        {/* Cluster bottom-left */}
        <div className="absolute" style={{ bottom: '20%', left: '8%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(147,197,253,0.4)', boxShadow: '0 0 10px rgba(147,197,253,0.3)' }} />
        <div className="absolute" style={{ bottom: '28%', left: '15%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(96,165,250,0.3)' }} />
        <div className="absolute" style={{ bottom: '15%', left: '18%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(59,130,246,0.45)', boxShadow: '0 0 14px rgba(59,130,246,0.35)' }} />
        <svg className="absolute" style={{ bottom: '10%', left: '5%', width: '20%', height: '30%', opacity: 0.12 }}>
          <line x1="30%" y1="60%" x2="65%" y2="35%" stroke="#93C5FD" strokeWidth="1" />
          <line x1="65%" y1="35%" x2="85%" y2="80%" stroke="#60A5FA" strokeWidth="1" />
          <line x1="30%" y1="60%" x2="85%" y2="80%" stroke="#93C5FD" strokeWidth="0.5" />
        </svg>

        {/* Scattered particles */}
        <div className="absolute" style={{ top: '45%', left: '30%', width: 3, height: 3, borderRadius: '50%', background: 'rgba(191,219,254,0.3)' }} />
        <div className="absolute" style={{ top: '35%', right: '35%', width: 3, height: 3, borderRadius: '50%', background: 'rgba(191,219,254,0.25)' }} />
        <div className="absolute" style={{ top: '60%', left: '55%', width: 2, height: 2, borderRadius: '50%', background: 'rgba(191,219,254,0.2)' }} />
        <div className="absolute" style={{ bottom: '35%', right: '25%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(147,197,253,0.3)' }} />
      </div>

      {/* Layer 4: Animated gradient orbs */}
      <div
        className="bg-orb bg-orb-1 absolute"
        style={{
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)',
          top: '-220px',
          right: '-180px',
        }}
      />
      <div
        className="bg-orb bg-orb-2 absolute"
        style={{
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(30,58,138,0.25) 0%, rgba(29,78,216,0.1) 40%, transparent 70%)',
          bottom: '-200px',
          left: '-150px',
        }}
      />
      <div
        className="bg-orb bg-orb-3 absolute"
        style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)',
          top: '40%',
          left: '60%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Layer 5: Bottom gradient fade to page bg */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '20px', background: 'linear-gradient(to top, #F8FAFC, rgba(248,250,252,0))' }}
      />

      {/* Content */}
      <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
        {/* Logo */}
        {display.showLogo && (
          <div className="mb-8 flex justify-center">
            <div
              className="relative"
              style={{
                padding: '3px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                boxShadow: '0 0 30px rgba(59,130,246,0.45), 0 0 60px rgba(6,182,212,0.2)',
              }}
            >
              <img
                src={resolveMediaUrl(siteConfig.logo_url!)}
                alt="院徽"
                className="h-20 w-20 object-contain rounded-full"
                style={{ background: 'rgba(15,23,42,0.8)', padding: '6px' }}
              />
            </div>
          </div>
        )}


        {/* Main title */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display max-w-5xl mx-auto text-center"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #BFDBFE 40%, #93C5FD 70%, #DBEAFE 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'text-shimmer 6s linear infinite',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 30px rgba(59,130,246,0.4))',
            lineHeight: 1.4,
          }}
        >
          {display.displayProject.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </h1>

        {/* Gradient separator line */}
        <div className="mt-8 flex justify-center">
          <div
            style={{
              height: '1px',
              width: '280px',
              background: 'linear-gradient(90deg, transparent 0%, #BFDBFE 30%, #93C5FD 70%, transparent 100%)',
              opacity: 0.8,
            }}
          />
        </div>

        {/* Decorative dots */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: i === 1 ? '6px' : '4px',
                height: i === 1 ? '6px' : '4px',
                background: i === 1 ? '#93C5FD' : 'rgba(191,219,254,0.5)',
                boxShadow: i === 1 ? '0 0 8px rgba(147,197,253,0.8)' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Banner image overlay if set */}
      {display.showBanner && (
        <div className="w-full h-48 overflow-hidden" style={{ marginTop: '-2rem' }}>
          <img
            src={resolveMediaUrl(siteConfig.banner_url!)}
            alt="横幅"
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.25, mixBlendMode: 'luminosity' }}
          />
        </div>
      )}

      {/* Bottom fade-to-next-section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(30,58,138,0.25))' }}
      />
    </header>
  );
}

export { getDisplayConfig };
