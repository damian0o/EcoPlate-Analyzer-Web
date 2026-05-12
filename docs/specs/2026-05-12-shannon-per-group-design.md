# Shannon Index & Evenness per Carbon Group — Design

**Date:** 2026-05-12
**Scope:** EcoPlate-Analyzer-Web
**Source:** `docs/2026-05-07-review.md`, point 4

## Goal

Change **Shannon Index** and **Shannon Evenness** on the Tests tab to compute per carbon group, mirroring SAWCD. When no groups are selected, fall back to all six built-in groups so the button always produces a result without setup. Whole-plate Shannon is removed.

## Non-goals

- Adding new chart types beyond what's already in `charts.js` (we'll reuse `renderGroupedBarChart`).
- Per-individual-source Shannon (scientifically meaningless for a single substrate).
- Re-styling SAWCD's chart — it keeps its stacked normalized-percentage form.
- Reading carbon sources selection for per-group tests; that selection is ignored when groups are not also selected (existing "can't pick both" guard already covers conflicts).

## Change set

### `js/statistics.js`

Add two subset helpers; remove the old whole-plate ones (no longer used anywhere after this change).

```javascript
import { CARBON_SOURCE_MATRIX } from './carbon-sources.js';

export function calculateAWCD(matrix) { /* unchanged */ }
export function calculateSAWCD(matrix, groupSources) { /* unchanged */ }

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
```

Removed: `calculateShannonIndex(matrix)` and `calculateShannonEvenness(matrix)` — replaced semantically by the subset helpers.

### `js/tabs/tests-tab.js`

**Imports** — swap `calculateShannonIndex` / `calculateShannonEvenness` for the two new subset variants.

**`runTest(type)` — restructured branch logic:**

- Remove the SAWCD-specific guard (lines 174-178) that requires Carbon Group selection. SAWCD now defaults to all 6 groups when none selected (consistent with Shannon/Evenness).
- Keep the existing guard "Cannot filter by both Carbon Sources and Carbon Groups at the same time" (lines 180-183).
- Define `const isPerGroup = type === 'sawcd' || type === 'shannon' || type === 'evenness';`
- For per-group: iterate `groupNames = selectedGroups.length > 0 ? selectedGroups : Object.keys(CARBON_SOURCE_GROUPS)`, then for each record × group compute the right metric (SAWCD / Shannon / Evenness for subset) and push a result row with `category: group`.
- For AWCD (the only remaining whole-plate test): unchanged behavior.

**Chart dispatch (lines 257-261):**

```javascript
if (type === 'sawcd')                                 renderSAWCDChart(canvas, results);
else if (type === 'shannon' || type === 'evenness')   renderPerGroupBarChart(canvas, results, type);
else                                                  renderGroupedChart(canvas, results, type);
```

**New `renderPerGroupBarChart(canvas, results, type)`** — defined at the bottom of `tests-tab.js` next to the existing chart helpers. Mirrors `renderSAWCDChart`'s structure (group by `time × concentration` pairs, datasets per carbon group), but uses `renderGroupedBarChart` and raw values (no normalization to %):

```javascript
function renderPerGroupBarChart(canvas, results, type) {
  const pairMap = {};
  for (const r of results) {
    const concLabel = r.blank ? 'Blank' : String(r.concentration);
    const timeLabel = String(r.time);
    const pairKey = `${timeLabel} h\n${concLabel}`;
    if (!pairMap[pairKey]) pairMap[pairKey] = {};
    if (!pairMap[pairKey][r.category]) pairMap[pairKey][r.category] = [];
    pairMap[pairKey][r.category].push(r.value);
  }
  const pairLabels = Object.keys(pairMap);
  const allGroups = [...new Set(results.map(r => r.category))];
  const label = typeLabel(type);
  const datasets = allGroups.map(group => ({
    label: group,
    data: pairLabels.map(pair => {
      const vals = pairMap[pair][group] || [0];
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    })
  }));
  lastChartTitle = label;
  renderGroupedBarChart(canvas, {
    labels: pairLabels,
    datasets,
    xLabel: 'Time / Concentration',
    yLabel: label,
    title: label
  });
}
```

**Results table (`renderResultsTable`, line ~272):** rename the local `isSawcd` flag to `isPerGroup` and set it to `type === 'sawcd' || type === 'shannon' || type === 'evenness'`. The `<th>Category</th>` header and `<td>${r.category}</td>` cell now render for all three per-group test types.

**CSV export (`handleSaveCsv`, lines 394-421):** rename the local `isSawcd` flag to `isPerGroup` with the same expanded condition. The `headers.push('Category')` and `row.push(csvEscape(r.category))` now fire for shannon and evenness too, so the CSV columns mirror the on-screen table.

## Behavior matrix

| Test button | Groups selected | Sources selected | Result rows per record | Chart type |
|---|---|---|---|---|
| AWCD | (any) | (any) | 1 | grouped bars (existing `renderGroupedChart`) |
| SAWCD | none | none | 6 (all groups) | stacked %, existing |
| SAWCD | some | none | N (selected groups) | stacked %, existing |
| Shannon Index | none | none | 6 (all groups) | grouped bars (new `renderPerGroupBarChart`) |
| Shannon Index | some | none | N (selected groups) | grouped bars |
| Shannon Evenness | (same as Shannon Index) | | | |
| Any per-group test | some | some | error (existing guard) | — |
| Any per-group test | none | some | 6 (all groups, sources ignored) | per-group bars |

The "sources only" row reflects the intentional choice: source selection has no effect on per-group tests; only group selection matters.

## Testing

No automated test framework — manual verification.

**Checklist:**

- Load fixture data and add 3 records with distinct bacteria, same `concentration=0`, `time=0`.
- Tests tab → **Shannon Index** with nothing selected → results table has 6 rows × 3 records = 18 entries, one per (record, group). Chart shows 6 series.
- Tests tab → select 2 carbon groups → **Shannon Index** → 6 entries (3 records × 2 groups). Chart shows 2 series.
- Tests tab → **Shannon Evenness** behaves analogously.
- Tests tab → **SAWCD** with nothing selected → 18 entries, stacked-percent chart (now allowed; was previously blocked).
- Tests tab → **AWCD** with nothing selected → 3 entries (one per record), grouped chart unchanged.
- Tests tab → select both groups AND sources → click any per-group test → error message persists (existing guard).
- Tests tab → select only carbon sources (no groups) → click Shannon → defaults to all 6 groups (sources silently ignored).
- CSV export for Shannon and Evenness includes a Category column.
- No console errors or warnings during any of the above.
