# Shannon per Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shannon Index and Shannon Evenness compute per carbon group (like SAWCD), defaulting to all six groups when none selected. Remove whole-plate Shannon. Also lift the existing SAWCD selection requirement (consistency).

**Architecture:** Two new subset helpers in `statistics.js` (`calculateShannonIndexForSubset`, `calculateShannonEvennessForSubset`). `tests-tab.js` reworks `runTest`, the results table, the CSV export, and adds a new `renderPerGroupBarChart` helper. The existing SAWCD branch is generalized as "per-group" and includes shannon/evenness.

**Tech Stack:** Vanilla JS (ES modules), Chart.js, no test framework — manual verification.

**Spec:** `docs/specs/2026-05-12-shannon-per-group-design.md`

---

### Task 1: Add subset helpers to `statistics.js`

**Files:**
- Modify: `js/statistics.js` (append two new functions after `calculateShannonEvenness`)

- [ ] **Step 1: Append the two subset helpers**

Append the following two functions to the end of `js/statistics.js`, after the existing `calculateShannonEvenness` function (the existing whole-plate functions stay in place for now; they will be removed in Task 3):

```javascript
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

- [ ] **Step 2: Verify file is syntactically valid by reading the bottom**

Read `js/statistics.js` last 40 lines and confirm both functions are present, properly delimited, and the file ends with a closing brace and newline (no stray characters).

- [ ] **Step 3: Commit**

```bash
git add js/statistics.js
git commit -m "feat(stats): add subset-aware Shannon Index and Evenness"
```

---

### Task 2: Switch Tests tab to per-group Shannon/Evenness

**Files:**
- Modify: `js/tabs/tests-tab.js` (imports line 4; `runTest` lines 165-264; `renderResultsTable` line ~272; chart dispatch lines 257-261; new helper appended near other chart helpers; CSV export lines 394-421)

- [ ] **Step 1: Update imports**

Change line 4 from:
```javascript
import { calculateAWCD, calculateSAWCD, calculateShannonIndex, calculateShannonEvenness } from '../statistics.js';
```
to:
```javascript
import { calculateAWCD, calculateSAWCD, calculateShannonIndexForSubset, calculateShannonEvennessForSubset } from '../statistics.js';
```

- [ ] **Step 2: Refactor `runTest` — remove SAWCD-only guard, unify per-group branch**

Find the block starting at line 174 (the SAWCD-required-group guard plus the SAWCD/else split) — currently:
```javascript
  // For SAWCD, need carbon groups
  if (type === 'sawcd' && selectedGroups.length === 0) {
    showMessage('Please select at least one Carbon Group for SAWCD calculation.', 'error');
    return;
  }

  if (selectedSources.length > 0 && selectedGroups.length > 0) {
    showMessage('Cannot filter by both Carbon Sources and Carbon Groups at the same time.', 'error');
    return;
  }

  const criteria = {
    bacteria: getSelectedValues('tests-bacteria'),
    stressor: getSelectedValues('tests-stressor'),
    concentration: getSelectedValues('tests-concentration'),
    time: getSelectedValues('tests-time'),
    blank: getSelectedValues('tests-blank'),
    repetition: getSelectedValues('tests-repetition')
  };

  const records = filterRecords(criteria);

  if (records.length === 0) {
    showMessage('No records match the selected criteria.', 'info');
    document.getElementById('tests-results').innerHTML = '';
    document.getElementById('tests-chart-container').classList.add('hidden');
    document.getElementById('tests-actions').classList.add('hidden');
    lastResults = [];
    return;
  }

  // Calculate statistics for all records at once
  const results = [];

  if (type === 'sawcd') {
    const groupNames = selectedGroups.length > 0
      ? selectedGroups
      : Object.keys(CARBON_SOURCE_GROUPS);

    for (const rec of records) {
      for (const group of groupNames) {
        const sources = CARBON_SOURCE_GROUPS[group] || [];
        const value = calculateSAWCD(rec.ecoplate, sources);
        results.push({
          bacteria: rec.bacteria,
          stressor: rec.stressor,
          concentration: rec.concentration,
          time: rec.time,
          blank: rec.blank,
          repetition: rec.repetition,
          category: group,
          value
        });
      }
    }
  } else {
    const calcFn = type === 'awcd' ? calculateAWCD
      : type === 'shannon' ? calculateShannonIndex
      : calculateShannonEvenness;

    for (const rec of records) {
      results.push({
        bacteria: rec.bacteria,
        stressor: rec.stressor,
        concentration: rec.concentration,
        time: rec.time,
        blank: rec.blank,
        repetition: rec.repetition,
        value: calcFn(rec.ecoplate)
      });
    }
  }
```

Replace the whole block with:
```javascript
  if (selectedSources.length > 0 && selectedGroups.length > 0) {
    showMessage('Cannot filter by both Carbon Sources and Carbon Groups at the same time.', 'error');
    return;
  }

  const criteria = {
    bacteria: getSelectedValues('tests-bacteria'),
    stressor: getSelectedValues('tests-stressor'),
    concentration: getSelectedValues('tests-concentration'),
    time: getSelectedValues('tests-time'),
    blank: getSelectedValues('tests-blank'),
    repetition: getSelectedValues('tests-repetition')
  };

  const records = filterRecords(criteria);

  if (records.length === 0) {
    showMessage('No records match the selected criteria.', 'info');
    document.getElementById('tests-results').innerHTML = '';
    document.getElementById('tests-chart-container').classList.add('hidden');
    document.getElementById('tests-actions').classList.add('hidden');
    lastResults = [];
    return;
  }

  // Calculate statistics for all records at once
  const results = [];
  const isPerGroup = type === 'sawcd' || type === 'shannon' || type === 'evenness';

  if (isPerGroup) {
    const groupNames = selectedGroups.length > 0
      ? selectedGroups
      : Object.keys(CARBON_SOURCE_GROUPS);

    for (const rec of records) {
      for (const group of groupNames) {
        const sources = CARBON_SOURCE_GROUPS[group] || [];
        let value;
        if (type === 'sawcd') {
          value = calculateSAWCD(rec.ecoplate, sources);
        } else if (type === 'shannon') {
          value = calculateShannonIndexForSubset(rec.ecoplate, sources);
        } else {
          value = calculateShannonEvennessForSubset(rec.ecoplate, sources);
        }
        results.push({
          bacteria: rec.bacteria,
          stressor: rec.stressor,
          concentration: rec.concentration,
          time: rec.time,
          blank: rec.blank,
          repetition: rec.repetition,
          category: group,
          value
        });
      }
    }
  } else {
    // type === 'awcd' — whole-plate
    for (const rec of records) {
      results.push({
        bacteria: rec.bacteria,
        stressor: rec.stressor,
        concentration: rec.concentration,
        time: rec.time,
        blank: rec.blank,
        repetition: rec.repetition,
        value: calculateAWCD(rec.ecoplate)
      });
    }
  }
```

(Two semantic deletions: the SAWCD-required-group guard is gone; the `calcFn` branch is gone. The whole-plate Shannon path is removed entirely.)

- [ ] **Step 3: Update chart dispatch**

Find the dispatch block (currently lines 257-261):
```javascript
  if (type === 'sawcd') {
    renderSAWCDChart(canvas, results);
  } else {
    renderGroupedChart(canvas, results, type);
  }
```

Replace with:
```javascript
  if (type === 'sawcd') {
    renderSAWCDChart(canvas, results);
  } else if (type === 'shannon' || type === 'evenness') {
    renderPerGroupBarChart(canvas, results, type);
  } else {
    renderGroupedChart(canvas, results, type);
  }
```

- [ ] **Step 4: Add new `renderPerGroupBarChart` helper**

Append the following function immediately after the existing `renderSAWCDChart` function (which ends around line 391, just before `/* ---------- Graph export ---------- */`):

```javascript
function renderPerGroupBarChart(canvas, results, type) {
  // Group by (time, concentration) pairs, then by carbon group; values are averaged.
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

- [ ] **Step 5: Update results table — rename `isSawcd` to `isPerGroup`**

Find `renderResultsTable` (starts ~line 268). The variable assignment is currently:
```javascript
  const isSawcd = type === 'sawcd';
```
Replace that single line with:
```javascript
  const isPerGroup = type === 'sawcd' || type === 'shannon' || type === 'evenness';
```

Then in the same function, replace every occurrence of `isSawcd` with `isPerGroup` (there are two: one in the header build, one in the row build). Use a careful find-and-replace bounded to `renderResultsTable` to avoid touching unrelated code.

- [ ] **Step 6: Update CSV export — same rename**

Find `handleSaveCsv` (starts line 394). The variable assignment is currently:
```javascript
  const isSawcd = lastTestType === 'sawcd';
```
Replace with:
```javascript
  const isPerGroup = lastTestType === 'sawcd' || lastTestType === 'shannon' || lastTestType === 'evenness';
```

Replace the two `isSawcd` usages in the function (one for header push, one for row push) with `isPerGroup`.

- [ ] **Step 7: Verify imports and references look correct**

Run from the working directory:
```bash
grep -n "calculateShannonIndex\|calculateShannonEvenness" js/tabs/tests-tab.js
```
Expected: matches only `calculateShannonIndexForSubset` and `calculateShannonEvennessForSubset`. No bare `calculateShannonIndex(` or `calculateShannonEvenness(` calls.

```bash
grep -n "isSawcd" js/tabs/tests-tab.js
```
Expected: no matches.

```bash
grep -n "Please select at least one Carbon Group" js/tabs/tests-tab.js
```
Expected: no matches (the guard was removed).

- [ ] **Step 8: Commit**

```bash
git add js/tabs/tests-tab.js
git commit -m "feat(tests-tab): compute Shannon and Evenness per carbon group"
```

---

### Task 3: Remove dead whole-plate Shannon functions

**Files:**
- Modify: `js/statistics.js` (delete `calculateShannonIndex` and `calculateShannonEvenness`)

- [ ] **Step 1: Confirm no remaining usages**

Run:
```bash
grep -rn "calculateShannonIndex\b\|calculateShannonEvenness\b" js/
```
Expected: only the export lines inside `js/statistics.js`. No other usages. If anything else shows up, stop and report — Task 2 didn't fully migrate.

- [ ] **Step 2: Delete the two function definitions**

In `js/statistics.js`, delete both:
```javascript
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
```

The file should now contain `calculateAWCD`, `calculateSAWCD`, `calculateShannonIndexForSubset`, and `calculateShannonEvennessForSubset` only.

- [ ] **Step 3: Final grep confirmation**

```bash
grep -n "^export function" js/statistics.js
```
Expected output exactly:
```
export function calculateAWCD(matrix) {
export function calculateSAWCD(matrix, groupSources) {
export function calculateShannonIndexForSubset(matrix, sources) {
export function calculateShannonEvennessForSubset(matrix, sources) {
```

- [ ] **Step 4: Commit**

```bash
git add js/statistics.js
git commit -m "refactor(stats): remove unused whole-plate Shannon functions"
```

---

### Task 4: Manual verification

**Files:** none

- [ ] **Step 1: Start server**

From `EcoPlate-Analyzer-Web/`:
```bash
python3 -m http.server 8000
```

- [ ] **Step 2: Load data and add records**

Open `http://localhost:8000/`. Load Data → pick `tests/fixtures/sample_590.csv` + `sample_720.csv`, name `e1`, Load.
Fill metadata:
- Section 1: bacteria `b1`, stressor `s1`, concentration `0`, time `0`, repetition `1`
- Section 2: bacteria `b2`, stressor `s1`, concentration `0`, time `0`, repetition `1`
- Section 3: bacteria `b3`, stressor `s1`, concentration `0`, time `0`, repetition `1`

Click Add Records.

- [ ] **Step 3: Tests → Shannon Index, no selection**

Switch to **Tests**. With all filter lists empty, click **Shannon Index**.

Expected:
- Results table appears with a `Category` column.
- 3 records × 6 carbon groups = 18 rows.
- Each row has the value formatted to 4 decimals.
- Chart appears as grouped bars: x-axis shows time/concentration pair labels; 6 datasets (one per carbon group) in the legend.
- Green success message: `Calculated Shannon Index for 3 record(s).`

- [ ] **Step 4: Tests → Shannon Index with some groups selected**

Tick `polymers` and `amines` in Carbon Groups. Click **Shannon Index**.

Expected:
- Results table has 3 × 2 = 6 rows. Categories visible: `polymers`, `amines`.
- Chart has 2 datasets.

Untick the groups when done.

- [ ] **Step 5: Tests → Shannon Evenness**

With nothing selected, click **Shannon Evenness**.

Expected: 18 rows, Category column, 6 datasets in chart, values in [0..1] approximately.

- [ ] **Step 6: Tests → SAWCD without selection (newly allowed)**

With nothing selected, click **SAWCD**.

Expected:
- No error message about "Please select at least one Carbon Group" (this guard was removed).
- 18 rows.
- Stacked-percent chart with 6 datasets, y-axis goes to 100.

- [ ] **Step 7: Tests → AWCD (unchanged behavior)**

With nothing selected, click **AWCD**.

Expected: 3 rows (one per record), no Category column, grouped chart unchanged.

- [ ] **Step 8: Both groups and sources selected → error**

Tick any group in Carbon Groups AND any source in Carbon Sources. Click any per-group test.

Expected: red error `Cannot filter by both Carbon Sources and Carbon Groups at the same time.`

Untick when done.

- [ ] **Step 9: Sources only → defaults to all 6 groups**

Tick one or two Carbon Sources (no groups). Click **Shannon Index**.

Expected: behaves like Step 3 (18 rows, all 6 groups). Source selection is ignored for per-group calculation.

Untick.

- [ ] **Step 10: CSV export**

After running Shannon Index (or Evenness) → click **Save CSV**.

Open the downloaded `ecoplate-shannon.csv` (or `ecoplate-evenness.csv`):
- Header row: `Bacteria,Stressor,Concentration,Time,Blank,Repetition,Category,Shannon Index` (or `Shannon Evenness`).
- 18 data rows for the no-selection case.

Repeat for SAWCD and AWCD:
- SAWCD CSV has Category column.
- AWCD CSV does NOT have Category column.

- [ ] **Step 11: Console check**

DevTools console must be clean of errors and warnings throughout.

- [ ] **Step 12: Stop server**

`Ctrl+C` the `python3 -m http.server`.

---

## Verification checklist (verification-before-completion)

- [ ] Shannon Index produces per-group results (6 default, N when selected)
- [ ] Shannon Evenness produces per-group results (same shape as above)
- [ ] SAWCD no longer requires Carbon Group selection
- [ ] AWCD unchanged (whole-plate, no Category)
- [ ] Per-group chart for Shannon/Evenness is grouped (not stacked), raw values
- [ ] Both groups + sources selected → existing error message still shown
- [ ] Results table includes Category column for sawcd/shannon/evenness
- [ ] CSV export includes Category column for sawcd/shannon/evenness, not for awcd
- [ ] `grep -n "calculateShannonIndex\\|calculateShannonEvenness" js/` shows only the subset variants
- [ ] No browser console errors
