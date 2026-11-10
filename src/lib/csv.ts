export type CsvCell = string | number | null | undefined

export function csvEscape(v: CsvCell): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // Spreadsheet formula injection: a text cell starting with = + - @ (or tab/CR) can run as a formula
  // when the export is opened in Excel or Sheets. Prefix with an apostrophe so it stays text.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n'
}
