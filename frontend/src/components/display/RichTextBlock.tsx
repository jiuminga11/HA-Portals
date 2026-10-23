import type { RichTextContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";
import { prepareRichText } from "../../lib/displayContent";

interface Props {
  content: RichTextContent;
  headingTitles?: string[];
}

export default function RichTextBlock({ content, headingTitles = [] }: Props) {
  const { t, locale } = useLocale();

  if (!content.body) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <p>{t.section.noContent}</p>
      </div>
    );
  }

  const html = prepareRichText(content.body, headingTitles, locale);

  return (
    <div className="min-w-0 max-w-full">
      <div
        className="prose prose-xl prose-dark tech-prose min-w-0 max-w-full [overflow-wrap:anywhere] [&_a]:whitespace-normal [&_a]:[overflow-wrap:anywhere]
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
