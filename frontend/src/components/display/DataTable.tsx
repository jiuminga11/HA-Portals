import type { DataTableContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";
import { contentLang } from "../../lib/displayContent";

interface Props { content: DataTableContent }

export default function DataTable({ content }: Props) {
  const { columns = [], rows = [] } = content;
  const { t } = useLocale();
  if (!columns.length || !rows.length) {
    return <p className="reading-muted py-8 text-center">{t.section.noData}</p>;
  }
  return (
    <div className="min-w-0">
      <ol className="grid gap-4 md:hidden">
        {rows.map((row, index) => (
          <li key={index} className="data-record p-4 sm:p-5 rounded-xl">
            <p className="reading-muted text-sm mb-3">{t.dataTable.index} {index + 1}</p>
            <dl className="space-y-4">
              {columns.map((column, columnIndex) => (
                <div key={column.key} className="min-w-0 [overflow-wrap:anywhere]">
                  <dt lang={contentLang(column.title)} className="reading-muted text-sm mb-1">{column.title}</dt>
                  <dd lang={contentLang(row[column.key] || "")} className={columnIndex === 0 || column.bold ? "text-lg font-semibold whitespace-pre-wrap" : "text-lg whitespace-pre-wrap"}>
                    {row[column.key] || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      <div className="hidden md:block">
        <p className="reading-muted text-sm mb-3">{t.dataTable.scrollHint}</p>
        <div className="data-table-scroll overflow-x-auto rounded-xl" role="region" aria-label={t.dataTable.scrollLabel} tabIndex={0}>
          <table className="w-full text-lg">
            <thead><tr>
              <th scope="col" className="p-4 text-left">{t.dataTable.index}</th>
              {columns.map((column) => <th scope="col" key={column.key} lang={contentLang(column.title)} className="p-4 [overflow-wrap:anywhere]" style={{ width: column.width, textAlign: column.align ?? "left" }}>{column.title}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, index) => <tr key={index}>
                <td className="p-4 align-top reading-muted">{index + 1}</td>
                {columns.map((column) => <td key={column.key} lang={contentLang(row[column.key] || "")} className={`p-4 align-top whitespace-pre-wrap [overflow-wrap:anywhere] ${column.bold ? "font-semibold" : ""}`} style={{ textAlign: column.align ?? "left", minWidth: column.width }}>
                  {row[column.key] || "—"}
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
