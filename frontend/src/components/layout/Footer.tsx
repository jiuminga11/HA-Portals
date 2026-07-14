import { Link } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";

export default function Footer() {
  const { t } = useLocale();
  return (
    <footer
      className="relative mt-auto py-8 px-4"
      style={{ borderTop: "1px solid var(--hairline-2)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ color: "var(--ink-4)", fontSize: "13px" }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{t.footer.copyright}</span>
            <a
              href={`mailto:${t.footer.email}`}
              className="transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              {t.footer.email}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span>{t.footer.builtWith}</span>
            <Link
              to="/admin/login"
              className="transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70"
              style={{ color: "var(--ink-4)" }}
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
