# Integer-only Concentration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain the Concentration field on the Load Data and Edit tabs to non-negative integers (zero included), matching the existing rule for Time and Repetition.

**Architecture:** Two surface changes per tab — flip `step="any"` to `step="1"` on the `<input type="number">` and tighten the JS validator with `!Number.isInteger(value)`. No new files, no shared helpers (consistent with existing duplicated load/edit validation patterns). No persistence layer; in-memory records only.

**Tech Stack:** Vanilla JS (ES modules), HTML5 number inputs. No test framework — manual verification in browser.

**Spec:** `docs/specs/2026-05-10-integer-concentration-design.md`

---

### Task 1: Load Data tab — Concentration integer guard

**Files:**
- Modify: `js/tabs/load-tab.js:184` (input attribute)
- Modify: `js/tabs/load-tab.js:274-276` (validation block)

- [ ] **Step 1: Change input step**

In `js/tabs/load-tab.js` at line 184, change:
```html
        <input type="number" id="concentration-${i}" min="0" step="any" placeholder="0">
```
to:
```html
        <input type="number" id="concentration-${i}" min="0" step="1" placeholder="0">
```

- [ ] **Step 2: Tighten validator**

In `js/tabs/load-tab.js` at lines 274-276, change:
```javascript
    const concentration = Number(concentrationStr);
    if (concentrationStr === '' || isNaN(concentration) || concentration < 0) {
      errors.push(`${label}: Concentration must be a number >= 0`);
    }
```
to:
```javascript
    const concentration = Number(concentrationStr);
    if (concentrationStr === '' || !Number.isInteger(concentration) || concentration < 0) {
      errors.push(`${label}: Concentration must be an integer >= 0`);
    }
```

Reasoning: `Number.isInteger(NaN)` is `false`, so the `isNaN` check is subsumed. The error message wording is aligned with the existing `Time must be an integer >= 0` text.

- [ ] **Step 3: Commit**

```bash
git add js/tabs/load-tab.js
git commit -m "feat(load-tab): require Concentration to be a non-negative integer"
```

---

### Task 2: Edit tab — Concentration integer guard

**Files:**
- Modify: `js/tabs/edit-tab.js:154` (input attribute)
- Modify: `js/tabs/edit-tab.js:242-244` (validation block in `handleUpdate`)

- [ ] **Step 1: Change input step**

In `js/tabs/edit-tab.js` at line 154, change:
```html
        <input type="number" id="edit-concentration-${i}" min="0" step="any" placeholder="0" value="${rec.concentration != null ? rec.concentration : ''}">
```
to:
```html
        <input type="number" id="edit-concentration-${i}" min="0" step="1" placeholder="0" value="${rec.concentration != null ? rec.concentration : ''}">
```

(Only the `step` attribute changes — everything else, including the value-template expression, is preserved.)

- [ ] **Step 2: Tighten validator**

In `js/tabs/edit-tab.js` at lines 242-244 (inside `handleUpdate()`), change:
```javascript
    const concentration = Number(concentrationStr);
    if (concentrationStr === '' || isNaN(concentration) || concentration < 0) {
      errors.push(`${label}: Concentration must be a number >= 0`);
    }
```
to:
```javascript
    const concentration = Number(concentrationStr);
    if (concentrationStr === '' || !Number.isInteger(concentration) || concentration < 0) {
      errors.push(`${label}: Concentration must be an integer >= 0`);
    }
```

- [ ] **Step 3: Commit**

```bash
git add js/tabs/edit-tab.js
git commit -m "feat(edit-tab): require Concentration to be a non-negative integer"
```

---

### Task 3: Manual verification

**Files:** none

- [ ] **Step 1: Start server**

From `EcoPlate-Analyzer-Web/`:
```bash
python3 -m http.server 8000
```

- [ ] **Step 2: Smoke test Load Data tab**

Open `http://localhost:8000/`, switch to **Load Data**.

1. Load fixtures: enter any experiment name, pick `tests/fixtures/sample_590.csv` and `tests/fixtures/sample_720.csv`, click **Load**.
2. In Section 1: bacteria `e1`, stressor `s1`, **Concentration `2.5`**, Time `0`, Repetition `1`.
3. Fill Section 2 and Section 3 with different metadata (any integer concentration).
4. Click **Add Records**.

Expected: red error `Section 1: Concentration must be an integer >= 0`. No records added.

Now change Section 1's Concentration to `0` and click **Add Records** again.
Expected: green `3 records added successfully!`.

- [ ] **Step 3: Smoke test Edit tab**

Switch to **Edit**.

1. Open one of the records just added.
2. Change Concentration to `1.5`.
3. Click the update button.

Expected: red error mentioning `Concentration must be an integer >= 0`.

Change Concentration back to an integer (e.g., `3`) → update succeeds.

- [ ] **Step 4: Spinner check**

Focus a Concentration field on either tab and press the up/down arrow keys (or click the spinner arrows). Each press should change the value by `1`, never by a fractional amount.

- [ ] **Step 5: Console check**

DevTools console must show zero errors and zero warnings during the above flows.

- [ ] **Step 6: Stop server**

`Ctrl+C` the `python3 -m http.server` process.

---

## Verification checklist (verification-before-completion)

- [ ] Load Data tab rejects `2.5` for Concentration with the new error message
- [ ] Load Data tab accepts `0` and any positive integer
- [ ] Edit tab rejects `1.5` for Concentration with the new error message
- [ ] Edit tab accepts integer concentrations
- [ ] Number-input spinner steps by `1` on both tabs
- [ ] No browser console errors
- [ ] `grep -n 'step="any"' js/tabs/load-tab.js js/tabs/edit-tab.js` returns no Concentration matches (Repetition and Time were never `step="any"`, so this grep should be empty for concentration lines)
