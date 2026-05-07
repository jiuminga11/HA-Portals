import { Link } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";
import type { SiteConfig } from "../../types";

interface Props {
  siteConfig: SiteConfig | null;
}

export default function Footer({ siteConfig: _siteConfig }: Props) {
  const { t } = useLocale();
  return (
    <footer className="relative mt-auto py-10 px-4">
      {/* Single top gradient line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-primary) 35%, var(--color-accent) 65%, transparent)',
        }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{t.footer.copyright}</span>
            <a
              href={`mailto:${t.footer.email}`}
              className="hover:underline transition-colors motion-reduce:transition-none"
              style={{ color: 'var(--color-primary)' }}
            >
              {t.footer.email}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs">{t.footer.builtWith}</span>
            <Link
              to="/admin/login"
              className="text-xs hover:underline transition-colors motion-reduce:transition-none"
              style={{ color: 'var(--text-muted)' }}
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
