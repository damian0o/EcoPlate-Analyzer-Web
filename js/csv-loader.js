export function parseEcoplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length !== 8) {
    throw new Error(`Expected 8 rows × 12 columns, got ${lines.length} rows`);
  }
  const fieldSep = lines[0].includes(';') ? ';' : ',';
  const decimalSep = fieldSep === ';' ? ',' : '.';
  return lines.map((line, r) => {
    const cells = line.split(fieldSep).map(c => c.trim());
    if (cells.length !== 12) {
      throw new Error(`Row ${r + 1}: expected 12 columns, got ${cells.length}`);
    }
    return cells.map((cell, c) => {
      const normalized = decimalSep === ',' ? cell.replace(',', '.') : cell;
      const value = Number(normalized);
      if (!Number.isFinite(value)) {
        throw new Error(`Row ${r + 1}, column ${c + 1} is not a number: '${cell}'`);
      }
      return value;
    });
  });
}
