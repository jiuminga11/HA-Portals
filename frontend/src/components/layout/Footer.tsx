import { Link } from "react-router-dom";
import { useLocale } from "../../hooks/useLocale";
import HXMark from "../common/HXMark";

export default function Footer() {
  const { t } = useLocale();
  return (
    <footer
      className="relative mt-auto py-8 px-4"
      style={{ borderTop: "1px solid var(--hairline-2)" }}
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <HXMark
          variant="divider"
          className="block mx-auto mb-6 opacity-40"
          style={{ width: 120, height: 12 }}
        />
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ color: "var(--ink-4)", fontSize: "15px" }}
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
            {import.meta.env.DEV ? (
              <Link
                to="/admin/login"
                className="transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70"
                style={{ color: "var(--ink-4)" }}
              >
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
