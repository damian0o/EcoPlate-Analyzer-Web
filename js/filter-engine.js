import { getIndex, getRecords } from './app-state.js';

/**
 * Filter records using multi-dimensional criteria.
 * @param {Object} criteria - {bacteria: [...], stressor: [...], concentration: [...], time: [...], blank: [...], repetition: [...]}
 *   Each key maps to an array of selected values, or empty array for "all".
 * @returns {Array} Array of matching EcoplateRecord objects
 */
export function filterRecords(criteria) {
  const index = getIndex();
  const allRecords = getRecords();

  // Replace empty arrays with 'default' (all values)
  const normalized = {};
  for (const [key, values] of Object.entries(criteria)) {
    normalized[key] = values.length > 0 ? values : ['default'];
  }

  // Cartesian product of all criteria
  const keys = Object.keys(normalized);
  const combinations = cartesianProduct(keys.map(k => normalized[k]));

  const resultSet = new Set();

  for (const combo of combinations) {
    let matching = null;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let value = combo[i];

      let candidates;
      if (value === 'default') {
        candidates = new Set(allRecords);
      } else {
        // FIX for blank: convert "Yes"/"No" string to boolean for index lookup
        if (key === 'blank') {
          value = value === 'Yes' || value === true;
        }
        // Convert numeric strings to numbers for concentration/time/repetition
        if (['concentration', 'time', 'repetition'].includes(key)) {
          value = Number(value);
        }
        candidates = new Set(index[key][value] || []);
      }

      if (candidates.size === 0) continue;

      if (matching === null) {
        matching = candidates;
      } else {
        matching = new Set([...matching].filter(r => candidates.has(r)));
      }

      if (matching.size === 0) break;
    }

    if (matching) {
      for (const r of matching) resultSet.add(r);
    }
  }

  return [...resultSet];
}

function cartesianProduct(arrays) {
  return arrays.reduce((acc, arr) => {
    const result = [];
    for (const a of acc) {
      for (const b of arr) {
        result.push([...a, b]);
      }
    }
    return result;
  }, [[]]);
}
