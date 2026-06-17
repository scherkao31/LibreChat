import React, { memo, useMemo, useState, useCallback } from 'react';
import { cn } from '~/utils';
import { columnLetter } from '~/utils/spreadsheet';
import type { SheetData, WorkbookData } from '~/utils/spreadsheet';

/**
 * Interactive, READ-ONLY spreadsheet grid for the Artifacts panel.
 *
 * Renders a mini read-only Excel: a formula bar at the top showing the
 * active cell's address + raw value/formula, a scrollable grid with
 * sticky column-letter and row-number headers, ExcelJS-extracted cell
 * styling (fills, font color/weight, alignment, number formats), merged
 * cells via col/rowspan, single-cell selection, and a bottom strip of
 * clickable sheet tabs.
 *
 * No editing. Pure presentation over the pre-parsed `WorkbookData` from
 * `useSpreadsheetArtifact`/`parseSpreadsheet`.
 */

const HEADER_BG = 'var(--surface-secondary)';
const HEADER_TEXT = 'var(--text-secondary)';
const GRID_BORDER = 'var(--border-medium)';
const ROW_HEADER_WIDTH = 48;

interface ActiveCell {
  row: number;
  col: number;
}

function SheetView({ sheet }: { sheet: SheetData }) {
  const [active, setActive] = useState<ActiveCell>({ row: 0, col: 0 });

  const activeCell = useMemo(() => {
    const r = sheet.rows[active.row];
    return r ? r[active.col] : undefined;
  }, [sheet, active]);

  const handleSelect = useCallback((row: number, col: number) => {
    setActive({ row, col });
  }, []);

  const colLetters = useMemo(
    () => Array.from({ length: sheet.colCount }, (_, i) => columnLetter(i + 1)),
    [sheet.colCount],
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Formula bar */}
      <div
        className="flex h-9 flex-shrink-0 items-center gap-2 border-b px-2 text-sm"
        style={{ borderColor: GRID_BORDER, background: HEADER_BG }}
      >
        <span
          className="inline-flex h-6 min-w-[3.5rem] items-center justify-center rounded border px-2 font-mono text-xs"
          style={{ borderColor: GRID_BORDER, color: HEADER_TEXT }}
        >
          {activeCell?.address ?? ''}
        </span>
        <span className="text-text-tertiary">fx</span>
        <span
          className="flex-1 truncate font-mono text-xs text-text-primary"
          title={activeCell?.raw ?? ''}
        >
          {activeCell?.raw ?? ''}
        </span>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto bg-surface-primary text-text-primary">
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}
        >
          <thead>
            <tr>
              {/* Top-left corner */}
              <th
                className="sticky left-0 top-0 z-30"
                style={{
                  width: ROW_HEADER_WIDTH,
                  minWidth: ROW_HEADER_WIDTH,
                  background: HEADER_BG,
                  borderRight: `1px solid ${GRID_BORDER}`,
                  borderBottom: `1px solid ${GRID_BORDER}`,
                }}
              />
              {colLetters.map((letter, c) => (
                <th
                  key={c}
                  className="sticky top-0 z-20 px-1 text-center text-xs font-normal"
                  style={{
                    width: sheet.colWidths[c],
                    minWidth: sheet.colWidths[c],
                    height: 22,
                    color: HEADER_TEXT,
                    background: HEADER_BG,
                    borderRight: `1px solid ${GRID_BORDER}`,
                    borderBottom: `1px solid ${GRID_BORDER}`,
                  }}
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r}>
                {/* Row number header */}
                <th
                  className="sticky left-0 z-10 text-center text-xs font-normal"
                  style={{
                    width: ROW_HEADER_WIDTH,
                    minWidth: ROW_HEADER_WIDTH,
                    color: HEADER_TEXT,
                    background: HEADER_BG,
                    borderRight: `1px solid ${GRID_BORDER}`,
                    borderBottom: `1px solid ${GRID_BORDER}`,
                  }}
                >
                  {r + 1}
                </th>
                {row.map((cell, c) => {
                  if (cell.merged) {
                    return null;
                  }
                  const isActive = active.row === r && active.col === c;
                  return (
                    <td
                      key={c}
                      onClick={() => handleSelect(r, c)}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className={cn(
                        'cursor-default overflow-hidden text-ellipsis whitespace-nowrap px-1 text-xs',
                        isActive ? 'outline outline-2 -outline-offset-1' : '',
                      )}
                      style={{
                        height: 22,
                        borderRight: `1px solid ${GRID_BORDER}`,
                        borderBottom: `1px solid ${GRID_BORDER}`,
                        outlineColor: isActive ? 'var(--ring-primary, #2563eb)' : undefined,
                        ...cell.style,
                      }}
                      title={cell.text}
                    >
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MemoSheetView = memo(SheetView);

function SpreadsheetGrid({ workbook }: { workbook: WorkbookData }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const sheet = workbook.sheets[activeSheet] ?? workbook.sheets[0];

  return (
    <div className="flex h-full w-full flex-col bg-surface-primary">
      {/* `key` remounts the sheet view (and resets its selection) when the
          active tab changes. */}
      <div className="min-h-0 flex-1">
        <MemoSheetView key={activeSheet} sheet={sheet} />
      </div>

      {/* Sheet tabs */}
      {workbook.sheets.length > 1 && (
        <div
          className="flex h-9 flex-shrink-0 items-stretch gap-0.5 overflow-x-auto border-t px-1"
          style={{ borderColor: GRID_BORDER, background: HEADER_BG }}
        >
          {workbook.sheets.map((s, i) => {
            const isActive = i === activeSheet;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSheet(i)}
                className={cn(
                  'whitespace-nowrap border-t-2 px-3 text-xs transition-colors',
                  isActive
                    ? 'border-t-blue-500 bg-surface-primary font-medium text-text-primary'
                    : 'border-t-transparent text-text-secondary hover:bg-surface-hover',
                )}
                title={s.name}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(SpreadsheetGrid);
