export function parseEcoplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => line.split(',').map(c => Number(c.trim())));
}
