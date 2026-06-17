/**
 * Read-only spreadsheet parsing for the Artifacts panel.
 *
 * The office artifact for a spreadsheet carries a reference to the
 * ORIGINAL binary file (`fileId`/`filepath`/`fileSource`/`fileUser`).
 * We fetch that file (via the same authenticated download path the
 * download button uses) and parse it with ExcelJS — the only browser-
 * capable, MIT-licensed parser that reads cell STYLES (fills, fonts,
 * alignment), MERGES and NUMBER FORMATS. SheetJS Community (used on the
 * server to produce the static HTML fallback) drops all of that.
 *
 * Everything here returns plain, serialisable data so the React grid
 * component never touches an ExcelJS object directly and ExcelJS itself
 * is loaded lazily (dynamic import) — it stays out of the main bundle
 * and only loads when a user actually opens a spreadsheet artifact.
 */
import type { CSSProperties } from 'react';

/** A single rendered cell, already resolved to display text + styling. */
export interface SheetCell {
  /** Display text (number formats applied, formula results, dates, etc.). */
  text: string;
  /**
   * Raw underlying value for the formula bar. For a formula cell this is
   * the formula string prefixed with `=`; otherwise the display text.
   */
  raw: string;
  /** A1-style address, e.g. `B3`. */
  address: string;
  /** Inline style applied to the `<td>` (background, color, weight, …). */
  style?: CSSProperties;
  /** Set on the top-left anchor of a merged range; drives col/rowspan. */
  colSpan?: number;
  rowSpan?: number;
  /**
   * True for cells that are covered by another cell's merge (i.e. not the
   * top-left anchor). These are skipped when rendering the row.
   */
  merged?: boolean;
}

export interface SheetData {
  name: string;
  /** Number of columns to render (max across header + populated rows). */
  colCount: number;
  /** Number of rows to render. */
  rowCount: number;
  /** `rows[r][c]` — dense matrix, always `colCount` wide. */
  rows: SheetCell[][];
  /** Per-column pixel widths (best-effort, from the file). */
  colWidths: number[];
}

export interface WorkbookData {
  sheets: SheetData[];
}

/** Excel default column width is ~8.43 chars ≈ 64px; clamp for sanity. */
const DEFAULT_COL_WIDTH_PX = 80;
const MIN_COL_WIDTH_PX = 40;
const MAX_COL_WIDTH_PX = 400;
/** Hard caps so a pathological file can't lock up the panel. */
const MAX_RENDER_ROWS = 1000;
const MAX_RENDER_COLS = 100;

/** Convert a 1-based column index to its A1 letter(s): 1→A, 27→AA. */
export function columnLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** Convert A1 column letters to a 1-based index: A→1, AA→27. */
function letterToColumn(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n;
}

interface MergeRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** Parse an A1 range string (`"A1:B2"` or single `"C3"`) to a MergeRange. */
function parseMergeRange(range: string): MergeRange | null {
  const cellRe = /^\$?([A-Z]+)\$?(\d+)$/i;
  const [start, end] = range.split(':');
  const m1 = start ? cellRe.exec(start.trim().toUpperCase()) : null;
  if (!m1) {
    return null;
  }
  const c1 = letterToColumn(m1[1]);
  const r1 = parseInt(m1[2], 10);
  if (!end) {
    return { top: r1, left: c1, bottom: r1, right: c1 };
  }
  const m2 = cellRe.exec(end.trim().toUpperCase());
  if (!m2) {
    return null;
  }
  const c2 = letterToColumn(m2[1]);
  const r2 = parseInt(m2[2], 10);
  return {
    top: Math.min(r1, r2),
    left: Math.min(c1, c2),
    bottom: Math.max(r1, r2),
    right: Math.max(c1, c2),
  };
}

/** Excel "characters" column width → approximate pixels. */
function widthToPx(width: number | undefined): number {
  if (!width || !Number.isFinite(width)) {
    return DEFAULT_COL_WIDTH_PX;
  }
  // Roughly the Excel formula: px = round(width * 7) + 5.
  const px = Math.round(width * 7) + 5;
  return Math.max(MIN_COL_WIDTH_PX, Math.min(MAX_COL_WIDTH_PX, px));
}

/** ARGB hex (e.g. `FFEB9C`) or `00RRGGBB` → CSS `#rrggbb`. */
function argbToCss(argb: string | undefined): string | undefined {
  if (!argb || typeof argb !== 'string') {
    return undefined;
  }
  // ExcelJS gives 8-hex-digit ARGB; strip the alpha (first two) for CSS.
  if (argb.length === 8) {
    return `#${argb.slice(2)}`;
  }
  if (argb.length === 6) {
    return `#${argb}`;
  }
  return undefined;
}

/**
 * Resolve the display text for an ExcelJS cell. ExcelJS exposes a rich
 * `.text` getter that already applies number formats / date formatting /
 * formula results for most cells; we fall back to manual coercion for
 * the shapes it leaves as objects (rich text, hyperlinks, errors).
 */
function cellDisplayText(cell: ExcelCellLike): string {
  const value = cell.value;
  if (value == null) {
    return '';
  }
  // ExcelJS `.text` is the formatted string for the vast majority of
  // cells; prefer it so number formats and dates render like Excel.
  const text = cell.text;
  if (typeof text === 'string' && text.length > 0) {
    return text;
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // Formula cell: { formula, result }
    if ('result' in v && v.result != null) {
      return String(v.result);
    }
    // Hyperlink cell: { text, hyperlink }
    if ('text' in v && typeof v.text === 'string') {
      return v.text;
    }
    // Rich text: { richText: [{ text }, …] }
    if (Array.isArray((v as { richText?: unknown[] }).richText)) {
      return (v as { richText: Array<{ text?: string }> }).richText
        .map((r) => r.text ?? '')
        .join('');
    }
    // Error cell: { error: '#DIV/0!' }
    if ('error' in v && v.error != null) {
      return String(v.error);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
  }
  return String(value);
}

/** Raw value for the formula bar — surfaces the formula when present. */
function cellRawValue(cell: ExcelCellLike, display: string): string {
  const value = cell.value;
  if (value != null && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.formula === 'string') {
      return `=${v.formula}`;
    }
    if (typeof v.sharedFormula === 'string') {
      return `=${v.sharedFormula}`;
    }
  }
  return display;
}

/** Map an ExcelJS cell's style to inline CSS for the `<td>`. */
function cellStyle(cell: ExcelCellLike): CSSProperties | undefined {
  const style: CSSProperties = {};
  const { fill, font, alignment } = cell;

  if (fill && fill.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToCss(fill.fgColor?.argb);
    if (bg) {
      style.backgroundColor = bg;
    }
  }

  if (font) {
    const color = argbToCss(font.color?.argb);
    if (color) {
      style.color = color;
    }
    if (font.bold) {
      style.fontWeight = 600;
    }
    if (font.italic) {
      style.fontStyle = 'italic';
    }
    if (font.underline) {
      style.textDecoration = 'underline';
    }
    if (typeof font.size === 'number') {
      style.fontSize = `${font.size}px`;
    }
    if (typeof font.name === 'string') {
      style.fontFamily = font.name;
    }
  }

  if (alignment) {
    if (
      alignment.horizontal === 'left' ||
      alignment.horizontal === 'right' ||
      alignment.horizontal === 'center'
    ) {
      style.textAlign = alignment.horizontal;
    }
    if (
      alignment.vertical === 'top' ||
      alignment.vertical === 'middle' ||
      alignment.vertical === 'bottom'
    ) {
      style.verticalAlign = alignment.vertical;
    }
    if (alignment.wrapText) {
      style.whiteSpace = 'normal';
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

/* Minimal structural typings for the bits of the ExcelJS cell/worksheet
 * we read. ExcelJS ships its own types, but importing them at module
 * top-level would pull the types eagerly; these local shapes keep the
 * parser self-describing and decoupled from the dynamic import. */
interface ExcelColor {
  argb?: string;
}
interface ExcelColumnLike {
  width?: number;
}
interface ExcelRowLike {
  getCell: (col: number) => ExcelCellLike;
}
interface ExcelWorksheetLike {
  name: string;
  columnCount?: number;
  rowCount?: number;
  getRow: (row: number) => ExcelRowLike;
  getColumn: (col: number) => ExcelColumnLike;
  /** Public model — `merges` is an array of A1 ranges like `"A1:B2"`. */
  model?: { merges?: string[] };
}
interface ExcelWorkbookLike {
  xlsx: { load: (buffer: ArrayBuffer) => Promise<unknown> };
  eachSheet: (cb: (worksheet: ExcelWorksheetLike, id: number) => void) => void;
}
interface ExcelCellLike {
  value: unknown;
  text: string;
  address: string;
  fill?: {
    type?: string;
    pattern?: string;
    fgColor?: ExcelColor;
  };
  font?: {
    color?: ExcelColor;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    name?: string;
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
  };
}

/**
 * Parse a raw `.xlsx`/`.xls`/`.ods` ArrayBuffer into render-ready
 * `WorkbookData`. Throws if ExcelJS can't read the buffer (the caller
 * falls back to the static HTML preview on any throw).
 */
export async function parseSpreadsheet(buffer: ArrayBuffer): Promise<WorkbookData> {
  // Lazy import keeps ExcelJS (~280 KB min, gzip ~90 KB) out of the main
  // bundle. Tolerate both `default`-wrapped and namespace interop shapes
  // so the import survives whichever entry (browser/ESM) Vite resolves.
  const mod = (await import('exceljs')) as unknown as {
    default?: { Workbook: new () => ExcelWorkbookLike };
    Workbook?: new () => ExcelWorkbookLike;
  };
  const WorkbookCtor = mod.default?.Workbook ?? mod.Workbook;
  if (!WorkbookCtor) {
    throw new Error('ExcelJS Workbook constructor not found');
  }
  const workbook = new WorkbookCtor();
  await workbook.xlsx.load(buffer);

  const sheets: SheetData[] = [];

  workbook.eachSheet((worksheet) => {
    const dimColCount = Math.min(
      Math.max(worksheet.columnCount ?? 0, 1),
      MAX_RENDER_COLS,
    );
    const dimRowCount = Math.min(
      Math.max(worksheet.rowCount ?? 0, 1),
      MAX_RENDER_ROWS,
    );

    // Build a lookup of merged ranges from the public worksheet model
    // (`merges` is an array of A1 range strings like `"A1:B2"`).
    const merges: MergeRange[] = (worksheet.model?.merges ?? [])
      .map(parseMergeRange)
      .filter((m): m is MergeRange => m != null);

    const mergeAnchor = new Map<string, MergeRange>();
    const mergedCovered = new Set<string>();
    for (const m of merges) {
      mergeAnchor.set(`${m.top}:${m.left}`, m);
      for (let r = m.top; r <= m.bottom; r++) {
        for (let c = m.left; c <= m.right; c++) {
          if (r === m.top && c === m.left) {
            continue;
          }
          mergedCovered.add(`${r}:${c}`);
        }
      }
    }

    const rows: SheetCell[][] = [];
    for (let r = 1; r <= dimRowCount; r++) {
      const row = worksheet.getRow(r);
      const cells: SheetCell[] = [];
      for (let c = 1; c <= dimColCount; c++) {
        const address = `${columnLetter(c)}${r}`;
        if (mergedCovered.has(`${r}:${c}`)) {
          cells.push({ text: '', raw: '', address, merged: true });
          continue;
        }
        const cell = row.getCell(c);
        const text = cellDisplayText(cell);
        const raw = cellRawValue(cell, text);
        const style = cellStyle(cell);
        const anchor = mergeAnchor.get(`${r}:${c}`);
        cells.push({
          text,
          raw,
          address,
          style,
          colSpan: anchor ? anchor.right - anchor.left + 1 : undefined,
          rowSpan: anchor ? anchor.bottom - anchor.top + 1 : undefined,
        });
      }
      rows.push(cells);
    }

    const colWidths: number[] = [];
    for (let c = 1; c <= dimColCount; c++) {
      const col = worksheet.getColumn(c);
      colWidths.push(widthToPx(col?.width));
    }

    sheets.push({
      name: worksheet.name || `Sheet ${sheets.length + 1}`,
      colCount: dimColCount,
      rowCount: dimRowCount,
      rows,
      colWidths,
    });
  });

  if (sheets.length === 0) {
    throw new Error('Workbook has no readable sheets');
  }

  return { sheets };
}
