import type { DataTableContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: DataTableContent;
}

export default function DataTable({ content }: Props) {
  const { columns = [], rows = [] } = content;
  const { t } = useLocale();

  if (columns.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>{t.section.noData}</div>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      style={{ border: '1px solid var(--color-border)', borderRadius: '1rem' }}
    >
      <table className="w-full text-lg">
        <thead>
          <tr
            style={{
              background: 'var(--table-header-bg)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <th
              className="px-4 py-3.5 font-semibold whitespace-nowrap w-14 text-center"
              style={{ color: 'var(--table-header-ink)', letterSpacing: '0.03em' }}
            >
              {t.dataTable.index}
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-3.5 font-semibold whitespace-nowrap text-center"
                style={{
                  color: 'var(--table-header-ink)',
                  letterSpacing: '0.03em',
                  ...(col.width ? { width: col.width } : {}),
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="text-center py-8"
                style={{ color: 'var(--text-muted)' }}
              >
                {t.section.noData}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  background: rowIdx % 2 === 0 ? 'var(--card-bg)' : 'var(--table-row-alt)',
                  borderBottom: '1px solid var(--card-border)',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    rowIdx % 2 === 0 ? 'var(--card-bg)' : 'var(--table-row-alt)';
                }}
              >
                <td
                  className="px-4 py-3 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {rowIdx + 1}
                </td>
                {columns.map((col) => {
                  const align = col.align || 'left';
                  return (
                    <td
                      key={col.key}
                      className="px-5 py-3 max-w-xs"
                      style={{ color: 'var(--text-base)', textAlign: align, fontWeight: col.bold ? 600 : undefined }}
                      title={row[col.key] || ""}
                    >
                      <span className="block truncate">{row[col.key] || ""}</span>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
