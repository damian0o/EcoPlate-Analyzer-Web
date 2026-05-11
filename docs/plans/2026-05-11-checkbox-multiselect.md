# Checkbox Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<select multiple>` listboxes in Tests and Filter tabs with click-to-toggle checkbox lists, so a plain click deselects a selected item (current native UX requires Ctrl/Cmd).

**Architecture:** Three helper functions per tab (`filterColumn`, `populateFilterList`, `getSelectedValues`) move from `<select>`/`<option>` semantics to `<div>`/`<label><input type="checkbox">`. Public API (function signatures, return types) is unchanged, so downstream callers (`runTest`, `applyFilter`, `refreshTestsLists`, `refreshFilterLists`, CSV export, charts) need no modification. Filter tab's `handleClear` also gets a small update because it currently iterates `<option>` elements. A small CSS block is added for the new `.checkbox-list` container.

**Tech Stack:** Vanilla JS (ES modules), CSS. No test framework — manual verification.

**Spec:** `docs/specs/2026-05-11-checkbox-multiselect-design.md`

---

### Task 1: CSS for checkbox list

**Files:**
- Modify: `css/style.css` (append near existing `.filter-list` rules around line 373)

- [ ] **Step 1: Append checkbox list styles after the `.filter-list label:hover` block (line 373)**

Insert the following block immediately after the closing `}` of `.filter-list label:hover` (so it sits next to the related `.filter-list` rules):

```css
.checkbox-list {
  max-height: 12rem;
  overflow-y: auto;
  font-size: 0.82rem;
  padding: 0.2rem 0;
}
.checkbox-list-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.4rem;
  cursor: pointer;
  user-select: none;
}
.checkbox-list-item:hover {
  background: #edf2f7;
}
.checkbox-list-item input[type="checkbox"] {
  margin: 0;
  flex-shrink: 0;
}
```

Note: the outer `.filter-list` already provides its own border/background/max-height; this inner `.checkbox-list` is a plain scroll container so visuals remain consistent with the existing wrapper.

- [ ] **Step 2: Verify CSS file parses (no syntax error)**

Run from `EcoPlate-Analyzer-Web/`:
```bash
grep -c '^}' css/style.css
```
Expected: a number that increased by 4 from before (four new rule blocks). Read the appended section to confirm braces balance.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat(css): add styles for checkbox-list multi-select"
```

---

### Task 2: Convert Tests tab to checkbox list

**Files:**
- Modify: `js/tabs/tests-tab.js:81-88` (`filterColumn`)
- Modify: `js/tabs/tests-tab.js:90-102` (`populateFilterList`)
- Modify: `js/tabs/tests-tab.js:106-110` (`getSelectedValues`)

- [ ] **Step 1: Replace `filterColumn`**

Find (lines 81-88):
```javascript
function filterColumn(id, label) {
  return `
    <div class="filter-list">
      <h4>${label}</h4>
      <select id="${id}" multiple size="8" style="width:100%;font-size:0.82rem;border:none;outline:none"></select>
    </div>
  `;
}
```

Replace with:
```javascript
function filterColumn(id, label) {
  return `
    <div class="filter-list">
      <h4>${label}</h4>
      <div id="${id}" class="checkbox-list"></div>
    </div>
  `;
}
```

- [ ] **Step 2: Replace `populateFilterList`**

Find (lines 90-102):
```javascript
function populateFilterList(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const prevSelected = new Set(Array.from(select.selectedOptions).map(o => o.value));
  select.innerHTML = '';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    if (prevSelected.has(String(v))) opt.selected = true;
    select.appendChild(opt);
  });
}
```

Replace with:
```javascript
function populateFilterList(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const prevChecked = new Set(
    Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value)
  );
  container.innerHTML = '';
  values.forEach(v => {
    const label = document.createElement('label');
    label.className = 'checkbox-list-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(v);
    if (prevChecked.has(String(v))) cb.checked = true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + String(v)));
    container.appendChild(label);
  });
}
```

- [ ] **Step 3: Replace `getSelectedValues`**

Find (lines 106-110):
```javascript
function getSelectedValues(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions).map(o => o.value);
}
```

Replace with:
```javascript
function getSelectedValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
}
```

- [ ] **Step 4: Verify no remaining `<select>`/`selectedOptions` references in this file**

Run:
```bash
grep -nE "selectedOptions|<select |\.options\b|opt\.selected" js/tabs/tests-tab.js
```
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add js/tabs/tests-tab.js
git commit -m "feat(tests-tab): switch filter lists to click-to-toggle checkboxes"
```

---

### Task 3: Convert Filter tab to checkbox list (incl. `handleClear`)

**Files:**
- Modify: `js/tabs/filter-tab.js:82-88` (`filterColumn`)
- Modify: `js/tabs/filter-tab.js:90-103` (`populateFilterList`)
- Modify: `js/tabs/filter-tab.js:107-110` (`getSelectedValues`)
- Modify: `js/tabs/filter-tab.js:187-196` (`handleClear`)

- [ ] **Step 1: Replace `filterColumn`**

Find (lines 82-88):
```javascript
function filterColumn(id, label) {
  return `
    <div class="filter-list">
      <h4>${label}</h4>
      <select id="${id}" multiple size="8" style="width:100%;font-size:0.82rem;border:none;outline:none"></select>
    </div>
  `;
}
```

Replace with:
```javascript
function filterColumn(id, label) {
  return `
    <div class="filter-list">
      <h4>${label}</h4>
      <div id="${id}" class="checkbox-list"></div>
    </div>
  `;
}
```

- [ ] **Step 2: Replace `populateFilterList`**

Find (lines 90-103):
```javascript
function populateFilterList(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const prevSelected = new Set(Array.from(select.selectedOptions).map(o => o.value));
  select.innerHTML = '';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    if (prevSelected.has(String(v))) opt.selected = true;
    select.appendChild(opt);
  });
}
```

Replace with:
```javascript
function populateFilterList(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const prevChecked = new Set(
    Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value)
  );
  container.innerHTML = '';
  values.forEach(v => {
    const label = document.createElement('label');
    label.className = 'checkbox-list-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(v);
    if (prevChecked.has(String(v))) cb.checked = true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + String(v)));
    container.appendChild(label);
  });
}
```

- [ ] **Step 3: Replace `getSelectedValues`**

Find (lines 107-110):
```javascript
function getSelectedValues(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions).map(o => o.value);
}
```

Replace with:
```javascript
function getSelectedValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
}
```

- [ ] **Step 4: Replace `handleClear` body**

Find (lines 187-196):
```javascript
function handleClear() {
  const selects = document.querySelectorAll('#filter-selects select');
  selects.forEach(s => {
    Array.from(s.options).forEach(o => { o.selected = false; });
  });
  document.getElementById('filter-results').innerHTML = '';
  document.getElementById('filter-message').innerHTML = '';
  document.getElementById('filter-save-csv-btn').disabled = true;
  lastFilteredRecords = [];
}
```

Replace with:
```javascript
function handleClear() {
  const checkboxes = document.querySelectorAll('#filter-selects input[type="checkbox"]');
  checkboxes.forEach(cb => { cb.checked = false; });
  document.getElementById('filter-results').innerHTML = '';
  document.getElementById('filter-message').innerHTML = '';
  document.getElementById('filter-save-csv-btn').disabled = true;
  lastFilteredRecords = [];
}
```

Note: `#filter-selects` is the wrapper div around all 8 filter columns (search for `id="filter-selects"` to confirm); we now query for descendant checkboxes instead of options.

- [ ] **Step 5: Verify no remaining `<select>`/`selectedOptions`/`.options` references in this file**

Run:
```bash
grep -nE "selectedOptions|<select |\.options\b|opt\.selected" js/tabs/filter-tab.js
```
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add js/tabs/filter-tab.js
git commit -m "feat(filter-tab): switch filter lists to click-to-toggle checkboxes"
```

---

### Task 4: Manual verification

**Files:** none

- [ ] **Step 1: Start server**

From `EcoPlate-Analyzer-Web/`:
```bash
python3 -m http.server 8000
```

- [ ] **Step 2: Load some records**

Open `http://localhost:8000/`. On Load Data, pick `tests/fixtures/sample_590.csv` + `tests/fixtures/sample_720.csv`, name `e1`, click Load. Fill metadata for the 3 sections with different `bacteria` values (e.g. `e. coli`, `b. subtilis`, `p. aureus`), keep concentration `0`, time `0`, click Add Records.

- [ ] **Step 3: Tests tab — core toggle behavior**

Switch to **Tests**. In the `Bacteria` list:
- Click `e. coli` → checkbox checks.
- Click `e. coli` again → checkbox unchecks. **This is the key fix.**
- Click `e. coli` and `b. subtilis` → both checked (no Ctrl needed).
- Click `e. coli` again → unchecks only `e. coli`; `b. subtilis` stays checked.

Expected: pure toggle behavior.

- [ ] **Step 4: Tests tab — scrolling**

Click on `Carbon Sources` (31 items). Verify the inner list scrolls when you mouse-wheel inside it. Verify clicks still toggle correctly after scrolling.

- [ ] **Step 5: Tests tab — algorithm still works**

Select 2 bacteria and 2 carbon sources. Click **AWCD**. Expected: results table renders. The selection drives the calculation (confirms `getSelectedValues` still feeds the right strings).

- [ ] **Step 6: Filter tab — same toggle**

Switch to **Filter**. Select/deselect items in `Bacteria`, `Stressor`, `Time` lists. Click **Run** → filtered table renders. Click **Clear** → all checkboxes uncheck, results clear. (Confirms `handleClear` was updated.)

- [ ] **Step 7: Re-render preserves selection**

On Tests tab, with two checkboxes ticked in `Bacteria`, switch to Edit (or Load Data), add another record, switch back to Tests. The previously checked items should still be checked.

- [ ] **Step 8: Console check**

DevTools console must be empty of errors and warnings throughout.

- [ ] **Step 9: Stop server**

`Ctrl+C` the `python3 -m http.server` process.

---

## Verification checklist (verification-before-completion)

- [ ] Click toggles a single item without modifier keys (Tests + Filter)
- [ ] Multiple items can be checked independently
- [ ] Scrolling inside long lists works (Carbon Sources)
- [ ] `handleClear` un-checks every box on Filter
- [ ] Algorithms (AWCD/SAWCD/Shannon/Evenness) and Run/CSV/Charts still work
- [ ] Selection survives `refreshTestsLists` / `refreshFilterLists` re-rendering
- [ ] `grep -nE 'selectedOptions|<select |\\.options\\b' js/tabs/{tests,filter}-tab.js` returns no matches
- [ ] No browser console errors
