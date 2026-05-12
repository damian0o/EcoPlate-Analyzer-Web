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

export function calculateShannonIndexForSubset(matrix, sources) {
  const values = [];
  for (const source of sources) {
    for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
      const c = CARBON_SOURCE_MATRIX[r].indexOf(source);
      if (c !== -1) {
        const v = Number(matrix[r][c]);
        if (!isNaN(v) && v > 0) values.push(v);
        break;
      }
    }
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -values.reduce((h, v) => {
    const p = v / total;
    return h + p * Math.log(p);
  }, 0);
}

export function calculateShannonEvennessForSubset(matrix, sources) {
  const H = calculateShannonIndexForSubset(matrix, sources);
  let S = 0;
  for (const source of sources) {
    for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
      const c = CARBON_SOURCE_MATRIX[r].indexOf(source);
      if (c !== -1) {
        if (Number(matrix[r][c]) > 0) S++;
        break;
      }
    }
  }
  return S > 1 ? H / Math.log(S) : 0;
}
