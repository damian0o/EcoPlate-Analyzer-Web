export function parseEcoplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length !== 8) {
    throw new Error(`Expected 8 rows × 12 columns, got ${lines.length} rows`);
  }
  const fieldSep = lines[0].includes(';') ? ';' : ',';
  const decimalSep = fieldSep === ';' ? ',' : '.';
  return lines.map(line => {
    const cells = line.split(fieldSep).map(c => c.trim());
    return cells.map(cell => {
      const normalized = decimalSep === ',' ? cell.replace(',', '.') : cell;
      return Number(normalized);
    });
  });
}
