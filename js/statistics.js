import { CARBON_SOURCE_MATRIX } from './carbon-sources.js';

export function calculateAWCD(matrix) {
  // matrix: 8x4 array of numbers
  // Sum all values except first (Water well at [0][0]), divide by count
  let sum = 0, count = 0, first = true;
  for (const row of matrix) {
    for (const val of row) {
      if (first) { first = false; continue; }
      const v = Number(val);
      if (!isNaN(v)) { sum += v; count++; }
    }
  }
  return count > 0 ? sum / count : 0;
}

export function calculateSAWCD(matrix, groupSources) {
  // Calculate SAWCD for a specific carbon source group
  // Find each group source's position in CARBON_SOURCE_MATRIX, get value from matrix
  let sum = 0, count = 0;
  for (const source of groupSources) {
    for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
      const c = CARBON_SOURCE_MATRIX[r].indexOf(source);
      if (c !== -1) {
        const val = Math.max(0, Number(matrix[r][c]));
        if (!isNaN(val)) { sum += val; count++; }
        break;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

export function calculateShannonIndex(matrix) {
  // H = -sum(pi * ln(pi)) where pi = val/total for positive values
  // Skip first value (Water well)
  const values = [];
  let first = true;
  for (const row of matrix) {
    for (const val of row) {
      if (first) { first = false; continue; }
      const v = Number(val);
      if (!isNaN(v) && v > 0) values.push(v);
    }
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -values.reduce((h, v) => {
    const p = v / total;
    return h + p * Math.log(p);
  }, 0);
}

export function calculateShannonEvenness(matrix) {
  const H = calculateShannonIndex(matrix);
  let S = 0, first = true;
  for (const row of matrix) {
    for (const val of row) {
      if (first) { first = false; continue; }
      if (Number(val) > 0) S++;
    }
  }
  return S > 1 ? H / Math.log(S) : 0;
}
