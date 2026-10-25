import { useLocale } from "../../hooks/useLocale";
import adminZh from "../../locales/admin.zh.json";
import adminEn from "../../locales/admin.en.json";
import { useRef, useState } from "react";
import type { DataTableContent, DataTableColumn } from "../../types";
import ConfirmDialog from "../common/ConfirmDialog";

interface Props {
  content: DataTableContent;
  onChange: (content: DataTableContent) => void;
}

let colCounter = 1;

/* ────────────────── Paste Parser ────────────────── */

/** Parse HTML table from clipboard (Word tables) */
function parseHtmlTable(html: string): string[][] | null {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return null;

  const doc = new DOMParser().parseFromString(tableMatch[0], "text/html");
  const trs = doc.querySelectorAll("tr");
  if (trs.length === 0) return null;

  const grid: string[][] = [];
  trs.forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("td, th").forEach((cell) => {
      cells.push((cell.textContent || "").trim());
    });
    if (cells.length > 0) grid.push(cells);
  });
  return grid.length > 0 ? grid : null;
}

/** Parse tab/newline separated text (Excel, plain text) */
function parseTsvText(text: string): string[][] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return null;

  // Detect delimiter: tab first, then comma, then multiple spaces
  const firstLine = lines[0];
  let delimiter: string | RegExp = "\t";
  if (!firstLine.includes("\t")) {
    // No tabs — try comma (but only if every line has commas)
    const commaConsistent = lines.every((l) => l.includes(","));
    if (commaConsistent) {
      delimiter = ",";
    } else {
      // Try 2+ spaces as delimiter
      const spaceConsistent = lines.every((l) => /\s{2,}/.test(l));
      if (spaceConsistent) {
        delimiter = /\s{2,}/;
      } else {
        // Single column fallback
        return lines.map((l) => [l.trim()]);
      }
    }
  }

  return lines.map((line) =>
    typeof delimiter === "string"
      ? line.split(delimiter).map((c) => c.trim())
      : line.split(delimiter).map((c) => c.trim())
  );
}

/** Parse pasted content — try HTML first, then plain text */
function parsePaste(e: React.ClipboardEvent<HTMLTextAreaElement>): string[][] | null {
  // Try HTML (Word tables)
  const html = e.clipboardData.getData("text/html");
  if (html) {
    const fromHtml = parseHtmlTable(html);
    if (fromHtml && fromHtml[0].length > 1) return fromHtml;
  }
  // Fallback to plain text
  const text = e.clipboardData.getData("text/plain");
  if (text) return parseTsvText(text);
  return null;
}

/* ────────────────── Component ────────────────── */

export default function DataTableEditor({ content, onChange }: Props) {
  const { locale } = useLocale();
  const labels = locale === "en" ? adminEn : adminZh;
  const { columns = [], rows = [] } = content;
  const hasRows = rows.length > 0;
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<string | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<number | null>(null);

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importGrid, setImportGrid] = useState<string[][] | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<DataTableContent>) => {
    onChange({ ...content, ...patch });
  };

  const addColumn = () => {
    const key = `col_${colCounter++}`;
    update({ columns: [...columns, { key, title: labels.dataTable.defaultColumn.replace("{n}", String(columns.length + 1)) }] });
  };

  const updateColumn = (index: number, patch: Partial<DataTableColumn>) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], ...patch };
    update({ columns: newCols });
  };

  const deleteColumn = (key: string) => {
    const newCols = columns.filter((c) => c.key !== key);
    const newRows = rows.map((row) => {
      const r = { ...row };
      delete r[key];
      return r;
    });
    update({ columns: newCols, rows: newRows });
    setConfirmDeleteCol(null);
  };

  const moveColumn = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= columns.length) return;
    const newCols = [...columns];
    [newCols[index], newCols[target]] = [newCols[target], newCols[index]];
    update({ columns: newCols });
  };

  const addRow = () => {
    const emptyRow: Record<string, string> = {};
    columns.forEach((col) => (emptyRow[col.key] = ""));
    update({ rows: [...rows, emptyRow] });
  };

  const updateCell = (rowIdx: number, key: string, value: string) => {
    const newRows = [...rows];
    newRows[rowIdx] = { ...newRows[rowIdx], [key]: value };
    update({ rows: newRows });
  };

  const deleteRow = (rowIdx: number) => {
    update({ rows: rows.filter((_, i) => i !== rowIdx) });
  };

  /* ── Import logic ── */

  const openImport = () => {
    setImportOpen(true);
    setImportText("");
    setImportGrid(null);
    setFirstRowIsHeader(true);
    setImportMode(rows.length > 0 ? "append" : "replace");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const grid = parsePaste(e);
    if (grid && grid.length > 0) {
      e.preventDefault();
      // Show raw text for display
      setImportText(grid.map((r) => r.join("\t")).join("\n"));
      setImportGrid(grid);
    }
    // If parse fails, let default paste happen (user can manually fix)
  };

  const handleTextChange = (text: string) => {
    setImportText(text);
    // Re-parse on manual edits
    const grid = parseTsvText(text);
    setImportGrid(grid);
  };

  const doImport = () => {
    if (!importGrid || importGrid.length === 0) return;

    let headerRow: string[];
    let dataRows: string[][];

    if (firstRowIsHeader) {
      headerRow = importGrid[0];
      dataRows = importGrid.slice(1);
    } else {
      // Use existing column titles or generate defaults
      const colCount = importGrid[0].length;
      headerRow = Array.from({ length: colCount }, (_, i) =>
        columns[i]?.title || labels.dataTable.defaultColumn.replace("{n}", String(i + 1))
      );
      dataRows = importGrid;
    }

    // Build columns — reuse existing keys when titles match, otherwise create new ones
    const newCols: DataTableColumn[] = headerRow.map((title, i) => {
      const existing = columns.find((c) => c.title === title);
      if (existing) return existing;
      const key = `col_${colCounter++}`;
      return { key, title: title || labels.dataTable.defaultColumn.replace("{n}", String(i + 1)) };
    });

    // Build rows
    const importedRows: Record<string, string>[] = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      newCols.forEach((col, i) => {
        obj[col.key] = row[i] || "";
      });
      return obj;
    });

    if (importMode === "replace") {
      update({ columns: newCols, rows: importedRows });
    } else {
      // Append: merge column definitions, then append rows
      const mergedCols = [...columns];
      for (const col of newCols) {
        if (!mergedCols.find((c) => c.key === col.key)) {
          mergedCols.push(col);
        }
      }
      update({ columns: mergedCols, rows: [...rows, ...importedRows] });
    }

    setImportOpen(false);
  };

  // Preview data for the modal
  const previewHeaders = importGrid && firstRowIsHeader ? importGrid[0] : null;
  const previewRows = importGrid
    ? firstRowIsHeader ? importGrid.slice(1) : importGrid
    : [];

  return (
    <div className="space-y-6">
      {/* Column definitions */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">{labels.dataTable.columns}</h4>
          <button
            type="button"
            onClick={addColumn}
            className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {labels.dataTable.addColumn}
          </button>
        </div>
        {columns.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">{labels.dataTable.noColumns}</p>
        ) : (
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div key={col.key} className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-6">{labels.dataTable.key}</span>
                  <input
                    type="text"
                    value={col.key}
                    readOnly={hasRows}
                    onChange={(e) => {
                      if (!hasRows) {
                        updateColumn(idx, { key: e.target.value.replace(/\s+/g, "_") });
                      }
                    }}
                    title={hasRows ? labels.dataTable.keyLocked : ""}
                    className={`text-sm border rounded-lg px-2 py-1 w-28 font-mono ${
                      hasRows
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                        : "bg-white border-slate-200 focus:outline-none focus:ring-1 ring-primary"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-6">{labels.dataTable.title}</span>
                  <input
                    type="text"
                    value={col.title}
                    onChange={(e) => updateColumn(idx, { title: e.target.value })}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 w-28 bg-white focus:outline-none focus:ring-1 ring-primary"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-8">{labels.dataTable.width}</span>
                  <input
                    type="number"
                    value={col.width || ""}
                    onChange={(e) => updateColumn(idx, { width: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={labels.dataTable.auto}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 w-20 bg-white focus:outline-none focus:ring-1 ring-primary"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-8">{labels.dataTable.align}</span>
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(idx, { align: e.target.value as 'left' | 'center' | 'right' })}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 ring-primary"
                  >
                    <option value="left">{labels.dataTable.left}</option>
                    <option value="center">{labels.dataTable.center}</option>
                    <option value="right">{labels.dataTable.right}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => updateColumn(idx, { bold: !col.bold })}
                  title={labels.dataTable.bold}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    col.bold
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <strong>{labels.dataTable.boldShort}</strong>
                </button>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, -1)}
                    disabled={idx === 0}
                    title={labels.dataTable.moveLeft}
                    className="text-xs w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-30 transition-colors"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, 1)}
                    disabled={idx === columns.length - 1}
                    title={labels.dataTable.moveRight}
                    className="text-xs w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-30 transition-colors"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCol(col.key)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  {labels.dataTable.deleteColumn}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">{labels.dataTable.rows}</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openImport}
              className="text-xs px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {labels.dataTable.bulkImport}
            </button>
            <button
              type="button"
              onClick={addRow}
              disabled={columns.length === 0}
              className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {labels.dataTable.addRow}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
            {labels.dataTable.noRows}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                      {col.title}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 w-16">{labels.dataTable.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-2 py-1.5 border-b border-slate-100">
                        <input
                          type="text"
                          value={row[col.key] || ""}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          className="w-full text-sm border border-transparent rounded px-2 py-1 bg-transparent hover:border-slate-200 focus:border-primary focus:outline-none focus:bg-white transition-colors"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 border-b border-slate-100 text-center">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRow(rowIdx)}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50"
                      >
                        {labels.dataTable.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setImportOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">{labels.dataTable.importTitle}</h3>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Paste area */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  {labels.dataTable.pasteLabel}
                </label>
                <textarea
                  ref={textareaRef}
                  value={importText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={labels.dataTable.pastePlaceholder}
                  className="w-full h-32 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary font-mono resize-none"
                />
              </div>

              {/* Options */}
              {importGrid && importGrid.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={firstRowIsHeader}
                        onChange={(e) => setFirstRowIsHeader(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      {labels.dataTable.firstRowHeader}
                    </label>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>{labels.dataTable.importMode}</span>
                      <select
                        value={importMode}
                        onChange={(e) => setImportMode(e.target.value as "append" | "replace")}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 ring-primary"
                      >
                        <option value="append">{labels.dataTable.append}</option>
                        <option value="replace">{labels.dataTable.replace}</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">
                      {labels.dataTable.preview.replace("{rows}", String(previewRows.length)).replace("{cols}", String(importGrid[0].length))}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-52">
                      <table className="w-full text-sm">
                        {previewHeaders && (
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              {previewHeaders.map((h, i) => (
                                <th key={i} className="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                                  {h || <span className="text-slate-300">{labels.dataTable.emptyCell}</span>}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {previewRows.slice(0, 20).map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-1 text-slate-600 border-b border-slate-100 whitespace-nowrap">
                                  {cell || <span className="text-slate-300">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {previewRows.length > 20 && (
                            <tr>
                              <td
                                colSpan={importGrid[0].length}
                                className="px-3 py-1.5 text-center text-xs text-slate-400 bg-slate-50"
                              >
                                {labels.dataTable.moreRows.replace("{n}", String(previewRows.length - 20))}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-sm px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {labels.dataTable.cancel}
              </button>
              <button
                type="button"
                onClick={doImport}
                disabled={!importGrid || previewRows.length === 0}
                className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {previewRows.length > 0 ? labels.dataTable.importRows.replace("{n}", String(previewRows.length)) : labels.dataTable.import}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteCol}
        title={labels.dataTable.deleteColumn}
        message={labels.dataTable.deleteColumnMessage.replace("{title}", () => columns.find((c) => c.key === confirmDeleteCol)?.title || confirmDeleteCol || "")}
        confirmText={labels.dataTable.delete}
        danger
        onConfirm={() => confirmDeleteCol && deleteColumn(confirmDeleteCol)}
        onCancel={() => setConfirmDeleteCol(null)}
      />
      <ConfirmDialog
        open={confirmDeleteRow !== null}
        title={labels.dataTable.deleteRow}
        message={labels.dataTable.deleteRowMessage.replace("{n}", confirmDeleteRow !== null ? String(confirmDeleteRow + 1) : "")}
        confirmText={labels.dataTable.delete}
        danger
        onConfirm={() => { if (confirmDeleteRow !== null) { deleteRow(confirmDeleteRow); setConfirmDeleteRow(null); } }}
        onCancel={() => setConfirmDeleteRow(null)}
      />
    </div>
  );
}
