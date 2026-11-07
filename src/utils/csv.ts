/**
 * Minimal RFC 4180 CSV writer.
 *
 * - Fields containing the delimiter, quotes, CR or LF are quoted; quotes are doubled.
 * - Text cells starting with = + - @ (or tab/CR) are prefixed with ' so spreadsheets don't run
 *   them as formulas (CSV injection). Pass numbers as `number` to keep them numeric.
 * - Output starts with a UTF-8 BOM so Excel detects UTF-8 (accents like "ç", "ã" render correctly)
 *   and uses CRLF line endings.
 */
export type CsvCell = string | number | null | undefined;

export interface CsvOptions {
  /** ',' (default) or ';' (Excel in pt-BR and other comma-decimal locales). */
  delimiter?: ',' | ';';
  /** Decimal separator used for numeric cells. Default '.'. */
  decimal?: '.' | ',';
  /** Prepend a UTF-8 BOM. Default true. */
  bom?: boolean;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell, delimiter = ',', decimal = '.'): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    text = String(value);
    if (decimal === ',') text = text.replace('.', ',');
  } else {
    text = String(value);
    if (FORMULA_START.test(text)) text = `'${text}`;
  }
  const needsQuotes = text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][], { delimiter = ',', decimal = '.', bom = true }: CsvOptions = {}): string {
  const body = rows.map((row) => row.map((cell) => csvCell(cell, delimiter, decimal)).join(delimiter)).join('\r\n');
  return (bom ? '﻿' : '') + body + '\r\n';
}

/** Trigger a browser download of `content` as a file. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Safe-ish file name: letters/digits/dash/underscore, accents stripped. */
export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'group'
  );
}
