import type { RichTextContent } from "../../types";
import { basePath } from "../../lib/basePath";

interface Props {
  content: RichTextContent;
}

export default function RichTextBlock({ content }: Props) {
  if (!content.body) {
    return (
      <div className="text-center py-8" style={{ color: '#475569' }}>
        <p>暂无内容</p>
      </div>
    );
  }

  // Prefix root-relative /uploads/ paths in embedded HTML with basePath
  const html = basePath
    ? content.body.replace(/(src|href)="(\/uploads\/)/g, `$1="${basePath}$2`)
    : content.body;

  return (
    <div
      className="prose prose-xl max-w-none prose-dark
        prose-headings:font-display
        prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
        prose-p:leading-relaxed prose-p:text-lg
        prose-li:leading-relaxed prose-li:text-lg
        prose-img:rounded-xl prose-img:shadow-lg
        prose-table:text-lg
        prose-thead:bg-gradient-blue-cyan"
      style={{ color: 'var(--text-base)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
