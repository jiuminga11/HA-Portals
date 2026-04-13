import { Link } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";
import type { SiteConfig } from "../../types";

interface Props {
  siteConfig: SiteConfig | null;
}

export default function Footer({ siteConfig }: Props) {
  const { t } = useLocale();
  return (
    <footer
      className="mt-auto py-10 px-4 text-center"
      style={{
        background: "var(--footer-bg)",
        color: "var(--footer-text)",
        borderTop: "1px solid var(--border-glass)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Decorative separator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: "var(--color-primary)", opacity: 0.6 }}
          />
          <div
            className="w-12 h-px"
            style={{
              background: "linear-gradient(90deg, var(--color-primary), var(--color-gradient))",
              opacity: 0.4,
            }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--color-gradient)", opacity: 0.6 }}
          />
          <div
            className="w-12 h-px"
            style={{
              background: "linear-gradient(90deg, var(--color-gradient), var(--color-accent))",
              opacity: 0.4,
            }}
          />
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: "var(--color-accent)", opacity: 0.6 }}
          />
        </div>

        {/* Footer text — from admin config */}
        {siteConfig?.footer_text && (
          <p className="text-sm mb-3" style={{ color: "var(--footer-text)", opacity: 0.7 }}>
            {siteConfig.footer_text}
          </p>
        )}

        {/* Built with */}
        <p className="text-xs" style={{ color: "var(--footer-text)", opacity: 0.5 }}>
          {t.footer.builtWith}
        </p>

        {/* Admin entry */}
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 mt-4 text-xs transition-opacity duration-200"
          style={{ color: "var(--footer-text)", opacity: 0.4 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.4";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {t.nav.admin}
        </Link>
      </div>
    </footer>
  );
}
