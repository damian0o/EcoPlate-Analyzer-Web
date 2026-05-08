# Local CSV Loading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace remote JSON loading with local selection of two CSV files (raw OD590 + OD720, 8×12 each). Web app computes `OD590 − OD720`, splits into three 8×4 sections, renders existing grid.

**Architecture:** New pure parser module `js/csv-loader.js` (auto-detects `,`/`;` field separator and `.`/`,` decimal separator). `js/tabs/load-tab.js` rebuilt: two file inputs + experiment name field + Load button. `js/data-loader.js` deleted (only used by load-tab). Browser-runnable test runner at `tests/csv-loader.test.html`.

**Tech Stack:** Vanilla JS (ES modules), `FileReader` API. No package manager, no test framework — tests run by opening HTML in browser.

**Spec:** `docs/specs/2026-05-07-csv-local-loading-design.md`

---

### Task 1: Test fixtures and test-runner skeleton

**Files:**
- Create: `tests/fixtures/sample_590.csv`
- Create: `tests/fixtures/sample_720.csv`
- Create: `tests/csv-loader.test.html`

- [ ] **Step 1: Create OD590 fixture (comma + dot, 8 rows × 12 cols)**

`tests/fixtures/sample_590.csv`:
```
0.123,0.234,0.345,0.456,0.567,0.678,0.789,0.890,0.901,1.012,1.123,1.234
0.130,0.240,0.350,0.460,0.570,0.680,0.790,0.900,0.910,1.020,1.130,1.240
0.140,0.250,0.360,0.470,0.580,0.690,0.800,0.910,0.920,1.030,1.140,1.250
0.150,0.260,0.370,0.480,0.590,0.700,0.810,0.920,0.930,1.040,1.150,1.260
0.160,0.270,0.380,0.490,0.600,0.710,0.820,0.930,0.940,1.050,1.160,1.270
0.170,0.280,0.390,0.500,0.610,0.720,0.830,0.940,0.950,1.060,1.170,1.280
0.180,0.290,0.400,0.510,0.620,0.730,0.840,0.950,0.960,1.070,1.180,1.290
0.190,0.300,0.410,0.520,0.630,0.740,0.850,0.960,0.970,1.080,1.190,1.300
```

- [ ] **Step 2: Create OD720 fixture**

`tests/fixtures/sample_720.csv`:
```
0.023,0.034,0.045,0.056,0.067,0.078,0.089,0.090,0.101,0.112,0.123,0.134
0.030,0.040,0.050,0.060,0.070,0.080,0.090,0.100,0.110,0.120,0.130,0.140
0.040,0.050,0.060,0.070,0.080,0.090,0.100,0.110,0.120,0.130,0.140,0.150
0.050,0.060,0.070,0.080,0.090,0.100,0.110,0.120,0.130,0.140,0.150,0.160
0.060,0.070,0.080,0.090,0.100,0.110,0.120,0.130,0.140,0.150,0.160,0.170
0.070,0.080,0.090,0.100,0.110,0.120,0.130,0.140,0.150,0.160,0.170,0.180
0.080,0.090,0.100,0.110,0.120,0.130,0.140,0.150,0.160,0.170,0.180,0.190
0.090,0.100,0.110,0.120,0.130,0.140,0.150,0.160,0.170,0.180,0.190,0.200
```

- [ ] **Step 3: Create test runner skeleton**

`tests/csv-loader.test.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>csv-loader tests</title>
  <style>
    body { font-family: monospace; padding: 1rem; }
    .pass { color: green; }
    .fail { color: red; white-space: pre-wrap; }
    hr { margin: 1rem 0; }
    .summary { font-weight: bold; font-size: 1.2rem; }
  </style>
</head>
<body>
  <h1>csv-loader tests</h1>
  <div id="results"></div>
  <script type="module">
    import { parseEcoplateCsv } from '../js/csv-loader.js';

    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function test(name, fn) {
      try {
        fn();
        const div = document.createElement('div');
        div.className = 'pass';
        div.textContent = `PASS  ${name}`;
        results.appendChild(div);
        passed++;
      } catch (e) {
        const div = document.createElement('div');
        div.className = 'fail';
        div.textContent = `FAIL  ${name}\n      ${e.message}`;
        results.appendChild(div);
        failed++;
      }
    }

    function assertDeepEqual(actual, expected, msg) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) {
        throw new Error(`${msg || 'assertDeepEqual'}\n  expected: ${e}\n  actual:   ${a}`);
      }
    }

    function assertThrows(fn, expectedSubstrings) {
      let thrown;
      try { fn(); } catch (e) { thrown = e; }
      if (!thrown) throw new Error(`expected fn to throw, but it did not`);
      const subs = Array.isArray(expectedSubstrings) ? expectedSubstrings : [expectedSubstrings];
      for (const sub of subs) {
        if (!thrown.message.includes(sub)) {
          throw new Error(`expected error to include '${sub}', got: ${thrown.message}`);
        }
      }
    }

    // ---- tests added in subsequent tasks ----

    queueMicrotask(() => {
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = `\n${passed} passed, ${failed} failed`;
      results.appendChild(document.createElement('hr'));
      results.appendChild(summary);
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Verify test runner loads (will fail because csv-loader.js doesn't exist yet)**

Run: `python3 -m http.server 8000` from `EcoPlate-Analyzer-Web/`
Open: `http://localhost:8000/tests/csv-loader.test.html`
Expected: page loads, browser console shows module-not-found error for `csv-loader.js` (this is fine — Task 2 creates it).

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/sample_590.csv tests/fixtures/sample_720.csv tests/csv-loader.test.html
git commit -m "test: add csv-loader test runner skeleton and fixtures"
```

---

### Task 2: Parser happy path — comma + dot

**Files:**
- Create: `js/csv-loader.js`
- Modify: `tests/csv-loader.test.html` (add test)

- [ ] **Step 1: Add failing test before "---- tests added in subsequent tasks ----"**

In `tests/csv-loader.test.html`, replace the `// ---- tests added in subsequent tasks ----` line with:
```javascript
test('parses 8x12 with comma separator and dot decimal', () => {
  const text =
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2\n' +
    '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2';
  const matrix = parseEcoplateCsv(text);
  assertDeepEqual(matrix.length, 8);
  assertDeepEqual(matrix[0].length, 12);
  assertDeepEqual(matrix[0][0], 0.1);
  assertDeepEqual(matrix[7][11], 1.2);
});

// ---- tests added in subsequent tasks ----
```

- [ ] **Step 2: Reload test page — see test FAIL (module not found)**

Open `http://localhost:8000/tests/csv-loader.test.html`.
Expected: page loads but the test never runs because the module import fails. Console shows `404 csv-loader.js` or similar.

- [ ] **Step 3: Create minimal parser**

`js/csv-loader.js`:
```javascript
export function parseEcoplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => line.split(',').map(c => Number(c.trim())));
}
```

- [ ] **Step 4: Reload test page — see test PASS**

Expected: `PASS  parses 8x12 with comma separator and dot decimal` and `1 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/csv-loader.js tests/csv-loader.test.html
git commit -m "feat(csv): add parser with comma+dot dialect"
```

---

### Task 3: Parser dialect — semicolon + comma decimal (PL Excel)

**Files:**
- Modify: `js/csv-loader.js`
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add failing test**

Append before `// ---- tests added in subsequent tasks ----` in test runner:
```javascript
test('parses 8x12 with semicolon separator and comma decimal (PL Excel)', () => {
  const row = '0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2';
  const text = Array(8).fill(row).join('\n');
  const matrix = parseEcoplateCsv(text);
  assertDeepEqual(matrix.length, 8);
  assertDeepEqual(matrix[0].length, 12);
  assertDeepEqual(matrix[0][0], 0.1);
  assertDeepEqual(matrix[7][11], 1.2);
});
```

- [ ] **Step 2: Reload — see test FAIL**

Expected: `FAIL  parses 8x12 with semicolon separator and comma decimal (PL Excel)` because the current parser splits on `,` only, treating the whole row as one cell that fails `Number(...)`.

- [ ] **Step 3: Update parser to detect dialect**

Replace `js/csv-loader.js` with:
```javascript
export function parseEcoplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
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
```

- [ ] **Step 4: Reload — both tests PASS**

Expected: `2 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/csv-loader.js tests/csv-loader.test.html
git commit -m "feat(csv): auto-detect semicolon+comma dialect"
```

---

### Task 4: Parser tolerates trailing/empty lines

**Files:**
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add test (should already pass)**

Append to test runner before the marker:
```javascript
test('ignores trailing empty lines and whitespace-only lines', () => {
  const row = '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2';
  const text = Array(8).fill(row).join('\n') + '\n\n   \n';
  const matrix = parseEcoplateCsv(text);
  assertDeepEqual(matrix.length, 8);
});
```

- [ ] **Step 2: Reload — should PASS without code change**

The existing `.filter(l => l.length > 0)` after `.trim()` already drops blank/whitespace lines. Expected: `3 passed, 0 failed`.

- [ ] **Step 3: Commit**

```bash
git add tests/csv-loader.test.html
git commit -m "test(csv): verify empty-line tolerance"
```

---

### Task 5: Parser validates row count

**Files:**
- Modify: `js/csv-loader.js`
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add failing test**

Append to test runner:
```javascript
test('throws on wrong row count (7 rows)', () => {
  const row = '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2';
  const text = Array(7).fill(row).join('\n');
  assertThrows(() => parseEcoplateCsv(text), ['8 rows', '7']);
});
```

- [ ] **Step 2: Reload — see FAIL (no error thrown, returns 7×12 matrix)**

Expected: `FAIL  throws on wrong row count (7 rows)` with message `expected fn to throw, but it did not`.

- [ ] **Step 3: Add row-count validation to parser**

In `js/csv-loader.js`, after `if (lines.length === 0) return [];` and before the dialect-detection lines, replace the early return and the rest with:

```javascript
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
```

- [ ] **Step 4: Reload — all tests PASS**

Expected: `4 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/csv-loader.js tests/csv-loader.test.html
git commit -m "feat(csv): validate row count is exactly 8"
```

---

### Task 6: Parser validates column count per row

**Files:**
- Modify: `js/csv-loader.js`
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add failing test**

Append to test runner:
```javascript
test('throws on wrong column count with row index', () => {
  const goodRow = '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2';
  const badRow = '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.3'; // 13 cols
  const lines = [goodRow, goodRow, goodRow, badRow, goodRow, goodRow, goodRow, goodRow];
  assertThrows(() => parseEcoplateCsv(lines.join('\n')), ['Row 4', '12 columns', '13']);
});
```

- [ ] **Step 2: Reload — see FAIL (returns 8×varied matrix without error)**

- [ ] **Step 3: Add per-row column-count check**

In `js/csv-loader.js`, change the inner `lines.map(line => ...)` to use index and validate:

```javascript
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
    return cells.map(cell => {
      const normalized = decimalSep === ',' ? cell.replace(',', '.') : cell;
      return Number(normalized);
    });
  });
}
```

- [ ] **Step 4: Reload — all tests PASS**

Expected: `5 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/csv-loader.js tests/csv-loader.test.html
git commit -m "feat(csv): validate each row has exactly 12 columns"
```

---

### Task 7: Parser validates numeric cells

**Files:**
- Modify: `js/csv-loader.js`
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add failing test**

Append to test runner:
```javascript
test('throws when a cell is not a number, with row/col/value', () => {
  const goodRow = '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2';
  const badRow  = '0.1,0.2,0.3,0.4,abc,0.6,0.7,0.8,0.9,1.0,1.1,1.2'; // col 5 = "abc"
  const lines = [goodRow, goodRow, badRow, goodRow, goodRow, goodRow, goodRow, goodRow];
  assertThrows(() => parseEcoplateCsv(lines.join('\n')), ['Row 3', 'column 5', 'abc']);
});
```

- [ ] **Step 2: Reload — see FAIL (returns NaN instead of throwing)**

- [ ] **Step 3: Add numeric validation in cell mapper**

In `js/csv-loader.js`, change the inner `cells.map(cell => ...)` to use index and validate:

```javascript
return cells.map((cell, c) => {
  const normalized = decimalSep === ',' ? cell.replace(',', '.') : cell;
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Row ${r + 1}, column ${c + 1} is not a number: '${cell}'`);
  }
  return value;
});
```

The full file should now read:
```javascript
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
```

- [ ] **Step 4: Reload — all tests PASS**

Expected: `6 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/csv-loader.js tests/csv-loader.test.html
git commit -m "feat(csv): validate cells are finite numbers"
```

---

### Task 8: Tab-separated input falls through to shape error

**Files:**
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add test (should already pass via existing column-count check)**

Append to test runner:
```javascript
test('tab-separated input throws shape error (1 column detected)', () => {
  const row = '0.1\t0.2\t0.3\t0.4\t0.5\t0.6\t0.7\t0.8\t0.9\t1.0\t1.1\t1.2';
  const text = Array(8).fill(row).join('\n');
  assertThrows(() => parseEcoplateCsv(text), ['Row 1', '12 columns', '1']);
});
```

Reasoning: tab is neither `;` nor `,`, so `fieldSep` defaults to `,`. The whole row becomes one cell, column count check fires.

- [ ] **Step 2: Reload — should PASS without code change**

Expected: `7 passed, 0 failed`.

- [ ] **Step 3: Commit**

```bash
git add tests/csv-loader.test.html
git commit -m "test(csv): document tab-separated input behaviour"
```

---

### Task 9: Smoke test parser with fixture files

**Files:**
- Modify: `tests/csv-loader.test.html`

- [ ] **Step 1: Add fetch-based fixture test**

Append to test runner:
```javascript
async function asyncTest(name, fn) {
  try {
    await fn();
    const div = document.createElement('div');
    div.className = 'pass';
    div.textContent = `PASS  ${name}`;
    results.appendChild(div);
    passed++;
  } catch (e) {
    const div = document.createElement('div');
    div.className = 'fail';
    div.textContent = `FAIL  ${name}\n      ${e.message}`;
    results.appendChild(div);
    failed++;
  }
}

await asyncTest('parses sample_590.csv fixture', async () => {
  const text = await fetch('fixtures/sample_590.csv').then(r => r.text());
  const m = parseEcoplateCsv(text);
  assertDeepEqual(m.length, 8);
  assertDeepEqual(m[0].length, 12);
  assertDeepEqual(m[0][0], 0.123);
});

await asyncTest('parses sample_720.csv fixture', async () => {
  const text = await fetch('fixtures/sample_720.csv').then(r => r.text());
  const m = parseEcoplateCsv(text);
  assertDeepEqual(m.length, 8);
  assertDeepEqual(m[7][11], 0.2);
});
```

Note: place `await` calls at top level — the script is `type="module"` so top-level await works.

- [ ] **Step 2: Reload — all tests PASS**

Expected: `9 passed, 0 failed`.

- [ ] **Step 3: Commit**

```bash
git add tests/csv-loader.test.html
git commit -m "test(csv): add fixture-based smoke tests"
```

---

### Task 10: Replace file-selector UI in load-tab

**Files:**
- Modify: `js/tabs/load-tab.js` (lines 1, 14-70, ~74-116, ~256-352 affected)

- [ ] **Step 1: Replace the import line**

In `js/tabs/load-tab.js`, change line 1:
```javascript
import { fetchIndex, fetchExperiment } from '../data-loader.js';
```
to:
```javascript
import { parseEcoplateCsv } from '../csv-loader.js';
```

- [ ] **Step 2: Replace `buildFileSelector()` body**

Replace the entire `buildFileSelector` function (around lines 16-70) with:
```javascript
function buildFileSelector() {
  const container = document.getElementById('file-selector');
  container.innerHTML = `
    <h2 class="section-heading">Select Data File</h2>
    <div class="flex gap-1" style="flex-direction:column;align-items:flex-start;gap:0.6rem;max-width:520px">
      <label style="width:100%">
        Experiment name
        <input type="text" id="experiment-name" placeholder="e.g. experiment_001" style="width:100%">
      </label>
      <label style="width:100%">
        OD590 CSV
        <input type="file" id="od590-file" accept=".csv,text/csv">
      </label>
      <label style="width:100%">
        OD720 CSV
        <input type="file" id="od720-file" accept=".csv,text/csv">
      </label>
      <button id="load-file-btn" class="btn btn-primary" disabled>Load</button>
    </div>
  `;

  const nameInput = document.getElementById('experiment-name');
  const od590Input = document.getElementById('od590-file');
  const od720Input = document.getElementById('od720-file');
  const loadBtn = document.getElementById('load-file-btn');

  function updateLoadButton() {
    loadBtn.disabled = !(
      nameInput.value.trim().length > 0 &&
      od590Input.files.length === 1 &&
      od720Input.files.length === 1
    );
  }

  nameInput.addEventListener('input', updateLoadButton);
  od590Input.addEventListener('change', updateLoadButton);
  od720Input.addEventListener('change', updateLoadButton);

  loadBtn.addEventListener('click', () => handleLoad(nameInput, od590Input, od720Input, loadBtn));
}
```

- [ ] **Step 3: Replace `parseAndRenderGrid` with `handleLoad`**

Replace the entire `parseAndRenderGrid` function (around lines 74-116) with:
```javascript
async function handleLoad(nameInput, od590Input, od720Input, loadBtn) {
  const name = nameInput.value.trim();
  const od590File = od590Input.files[0];
  const od720File = od720Input.files[0];

  loadBtn.disabled = true;
  loadBtn.textContent = 'Loading...';

  try {
    const [text590, text720] = await Promise.all([
      readFileAsText(od590File),
      readFileAsText(od720File)
    ]);

    let od590, od720;
    try {
      od590 = parseEcoplateCsv(text590);
    } catch (e) {
      throw new Error(`OD590 CSV: ${e.message}`);
    }
    try {
      od720 = parseEcoplateCsv(text720);
    } catch (e) {
      throw new Error(`OD720 CSV: ${e.message}`);
    }

    const round3 = x => Math.round(x * 1000) / 1000;
    const diff = od590.map((row, r) => row.map((v, c) => round3(v - od720[r][c])));
    const matrices = [
      diff.map(r => r.slice(0, 4)),
      diff.map(r => r.slice(4, 8)),
      diff.map(r => r.slice(8, 12))
    ];

    loadedMatrices = matrices;
    loadedFileName = name;
    renderGrid(matrices);
    showMessage(`Loaded experiment: ${name}`, 'success', 3000);
  } catch (e) {
    showMessage(e.message, 'error');
  } finally {
    loadBtn.textContent = 'Load';
    loadBtn.disabled = false;
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}
```

- [ ] **Step 4: Verify file is syntactically valid**

Run from `EcoPlate-Analyzer-Web/`:
```bash
node --check js/tabs/load-tab.js
```
Expected: no output (success). If it errors with `Cannot use import statement outside a module`, that's a Node config issue with ESM — try `node -e "import('./js/tabs/load-tab.js')"` or just visually inspect; the browser is the source of truth.

- [ ] **Step 5: Commit**

```bash
git add js/tabs/load-tab.js
git commit -m "feat(load-tab): replace remote selector with local CSV inputs"
```

---

### Task 11: Delete data-loader.js

**Files:**
- Delete: `js/data-loader.js`

- [ ] **Step 1: Confirm no other files import it**

Run from `EcoPlate-Analyzer-Web/`:
```bash
grep -rn "data-loader" js/ index.html
```
Expected: no output (Task 10 removed the only reference).

- [ ] **Step 2: Delete the file**

Run:
```bash
rm js/data-loader.js
```

- [ ] **Step 3: Commit**

```bash
git add -A js/data-loader.js
git commit -m "refactor: remove unused remote data-loader module"
```

---

### Task 12: Manual verification

**Files:** none

- [ ] **Step 1: Start server**

Run from `EcoPlate-Analyzer-Web/`:
```bash
python3 -m http.server 8000
```

- [ ] **Step 2: Run unit tests**

Open `http://localhost:8000/tests/csv-loader.test.html`.
Expected: `9 passed, 0 failed`.

- [ ] **Step 3: Smoke test happy path**

Open `http://localhost:8000/`. Click **Load Data** tab.
- Type `experiment_test` in Experiment name.
- Pick `tests/fixtures/sample_590.csv` for OD590.
- Pick `tests/fixtures/sample_720.csv` for OD720.
- Click **Load**.

Expected:
- Green message: `Loaded experiment: experiment_test`.
- Grid shows 8×12 of corrected values. Cell A1 should show `0.100` (= 0.123 − 0.023).
- No console errors.

- [ ] **Step 4: Smoke test downstream tabs**

Still on Load Data:
- Fill in Section 1 metadata (bacteria=`E. coli`, stressor=`copper`, concentration=`0`, time=`0`, repetition=`1`).
- Fill in Section 2 and Section 3 (different metadata in at least one field).
- Click **Add Records**.

Expected: green message `3 records added successfully!`. Switch to **Edit** and **Filter** tabs — three records visible.

- [ ] **Step 5: Smoke test PL Excel format**

Create a quick `/tmp/pl_590.csv` with:
```
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
0,1;0,2;0,3;0,4;0,5;0,6;0,7;0,8;0,9;1,0;1,1;1,2
```
Use the same file for both OD590 and OD720 (so diff = 0). Load.
Expected: grid shows all `0.000`. No errors.

- [ ] **Step 6: Smoke test error handling**

Create `/tmp/bad.csv` with only 7 rows. Load as OD590 with a valid OD720.
Expected: red message containing `OD590 CSV: Expected 8 rows × 12 columns, got 7 rows`.

Replace bad file with one containing `xyz` in row 3, col 5. Load.
Expected: red message containing `OD590 CSV: Row 3, column 5 is not a number: 'xyz'`.

- [ ] **Step 7: Final grep**

Run from `EcoPlate-Analyzer-Web/`:
```bash
grep -rn "fetchIndex\|fetchExperiment\|data-loader" js/ index.html
```
Expected: no output.

- [ ] **Step 8: Commit any plan tracking changes**

```bash
git status
# if anything dirty (e.g. updated checkbox state), commit
```

---

## Verification checklist (verification-before-completion)

- [ ] All 9 parser tests pass in browser test runner
- [ ] Manual happy-path smoke test passes (fixture files load and render correctly, downstream Add Records works)
- [ ] Manual PL-Excel format smoke test passes
- [ ] Manual error-handling smoke tests show prefixed error messages
- [ ] `grep` confirms no remaining `data-loader` / `fetchIndex` / `fetchExperiment` references
- [ ] No browser console errors on the Load Data tab during a full load → add-records flow
