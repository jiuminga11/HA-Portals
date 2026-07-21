import type { RichTextContent } from "../../types";
import { basePath } from "../../lib/basePath";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: RichTextContent;
}

export default function RichTextBlock({ content }: Props) {
  const { t } = useLocale();

  if (!content.body) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <p>{t.section.noContent}</p>
      </div>
    );
  }

  // Prefix root-relative /uploads/ paths in embedded HTML with basePath
  const html = basePath
    ? content.body.replace(/(src|href)="(\/uploads\/)/g, `$1="${basePath}$2`)
    : content.body;

  return (
    <div>
      <div
        className="prose prose-xl prose-dark tech-prose
          prose-headings:font-display
          prose-h1:text-4xl prose-h2:text-2xl prose-h3:text-xl
          prose-p:text-lg
          prose-li:my-1 prose-li:leading-relaxed prose-li:text-lg
          prose-img:rounded-xl prose-img:shadow-lg
          prose-table:text-lg"
        style={{ color: 'var(--text-base)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
