# Local CSV Loading — Design

**Date:** 2026-05-07
**Scope:** EcoPlate-Analyzer-Web
**Source:** `docs/2026-05-07-review.md`, point 1

## Goal

Replace remote JSON loading from `EcoPlate-Data` with local file selection of two CSV files (raw OD590 and OD720, 8×12 each). The web app computes the corrected matrix `OD590 − OD720`, splits it into three 8×4 sections, and renders the existing grid — so the rest of the app (metadata form, Add Records, Edit, Filter, Tests) is unaffected.

## Non-goals

- Drag & drop or auto-load on file selection (Approach B from brainstorming — deferred).
- CSV export, alternative CSV layouts (single-file two-block, headered with A–H), or three-matrix CSV.
- Changes to `EcoPlate-Data/convert.py` or remote pipeline.

## Architecture

### File changes

| Action | Path | Purpose |
|---|---|---|
| **New** | `js/csv-loader.js` | Pure parser: `string` → `number[8][12]` |
| **Modified** | `js/tabs/load-tab.js` | Replace `buildFileSelector` UI; simplify `parseAndRenderGrid` flow |
| **Deleted** | `js/data-loader.js` | Used only by `load-tab.js`; no longer needed |
| **New** | `tests/csv-loader.test.html` | Browser-runnable test runner for parser |
| **New** | `tests/fixtures/sample_590.csv` | 8×12 example, comma + dot |
| **New** | `tests/fixtures/sample_720.csv` | 8×12 example, comma + dot |

Untouched: `app-state.js`, `record.js`, `tabs/edit-tab.js`, `tabs/filter-tab.js`, `tabs/tests-tab.js`, `index.html` (HTML containers stay the same).

### Data flow

```
[OD590.csv] ─┐                  ┌─→ matrices[0] (8×4, cols 0–3)
             ├─→ parse → 8×12 ──┤
[OD720.csv] ─┘   diff & round   ├─→ matrices[1] (8×4, cols 4–7)
             ── 8×12 (corrected)┤
                                └─→ matrices[2] (8×4, cols 8–11)
                                     ↓
                                  renderGrid()
                                     ↓
                          [user fills metadata + Add Records]
```

## Parser — `js/csv-loader.js`

**Export:** `parseEcoplateCsv(text: string): number[][]`

**Algorithm:**
1. Split on `\n` (or `\r\n`); trim each line; drop empty lines.
2. **Field separator detection:** on the first non-empty line, if `;` count ≥ 1 → `;`, else `,`.
3. **Decimal separator inference:** if field separator is `;` → decimal is `,`; if `,` → decimal is `.`.
4. For each line: split by field separator → trim each cell → if decimal is `,` replace `,` with `.` in cell → `Number(cell)`.
5. **Validation:**
   - Exactly 8 non-empty rows. Otherwise: `Error("Expected 8 rows × 12 columns, got <N> × ...")`
   - Each row exactly 12 columns. Otherwise: `Error("Row <r+1>: expected 12 columns, got <N>")` (per-row, since different rows could be wrong).
   - Each cell finite number (`Number.isFinite`). Otherwise: `Error("Row <r+1>, column <c+1> is not a number: '<raw>'")`
6. Return `number[8][12]`.

**Single responsibility:** parser does not compute differences, does not split into three matrices. Those live in `load-tab.js`.

## UI — `js/tabs/load-tab.js`

### `buildFileSelector()` — new content of `#file-selector`

```
Select Data File
  Experiment name: [______________________]
  OD590 CSV:       [Choose file]
  OD720 CSV:       [Choose file]
                   [ Load ]   ← disabled until name + both files
```

- Three controls wired with listeners (`input` for text, `change` for files) that re-evaluate Load button enabled state.
- Load button enabled iff `name.trim() !== ''` AND `od590Input.files.length === 1` AND `od720Input.files.length === 1`.

### Module state

- `loadedMatrices`: `number[3][8][4]` — set after successful Load.
- `loadedFileName`: `string` — set from the trimmed `Experiment name` field.

### Load handler — sequential gates

1. Read both files in parallel: `Promise.all([readText(od590File), readText(od720File)])`.
   - On `FileReader` error → `showMessage("Failed to read file: <name>", "error")`, abort.
2. Parse each through `parseEcoplateCsv`.
   - On parser error for OD590 → `showMessage("OD590 CSV: <error>", "error")`, abort.
   - On parser error for OD720 → `showMessage("OD720 CSV: <error>", "error")`, abort.
3. Compute corrected matrix: `diff[r][c] = round3(od590[r][c] - od720[r][c])` where `round3(x) = Math.round(x * 1000) / 1000`.
4. Split into three 8×4 sections: `matrices = [diff.map(r => r.slice(0,4)), diff.map(r => r.slice(4,8)), diff.map(r => r.slice(8,12))]`.
5. Set `loadedMatrices = matrices`, `loadedFileName = name.trim()`.
6. Call existing `renderGrid(matrices)`.
7. `showMessage("Loaded experiment: <name>", "success", 3000)`.

### After Load: no reset

Form keeps its values. Rationale: Load only renders the grid; records are created later by Add Records, so re-clicking Load is harmless and convenient.

### Removed

- `parseAndRenderGrid(...)` — its job (handling several JSON shapes from remote) collapses into the steps above.
- All references to `fetchIndex` / `fetchExperiment` and the `<select>` dropdown.

## Cleanup — `js/data-loader.js`

`grep` confirms it is only imported by `load-tab.js`. Delete the file after removing the import.

## Validation rules summary

| Trigger | Surface | Message |
|---|---|---|
| Empty experiment name | Load button disabled | — (UI affordance) |
| Missing OD590 or OD720 file | Load button disabled | — |
| FileReader error | Inline error | `Failed to read file: <name>` |
| Wrong row count | Inline error | `OD590 CSV: Expected 8 rows × 12 columns, got 7 × 12` |
| Wrong column count | Inline error | `OD720 CSV: Row 4: expected 12 columns, got 11` |
| Non-numeric cell | Inline error | `OD590 CSV: Row 3, column 5 is not a number: 'abc'` |

## Testing

### Parser (TDD)

Test runner: `tests/csv-loader.test.html` — minimal HTML page that imports `csv-loader.js` as ES module, runs assertions, and prints results to the page. Run by opening the file in a browser (e.g., via `python3 -m http.server` from `EcoPlate-Analyzer-Web/`).

**Test cases (write before implementing parser):**

1. Comma + dot, 8×12 → returns `number[8][12]` with correct values.
2. Semicolon + comma decimal (PL Excel), 8×12 → same numeric result as case 1.
3. Trailing empty lines → ignored, parses successfully.
4. 7 rows → throws with message containing `"7"` and `"rows"`.
5. 13 columns on row 4 → throws with message containing `"4"` (row index, 1-based), `"13"`, and `"columns"`.
6. Cell `"abc"` at row 3, col 5 → throws with message containing `"3"`, `"5"`, `"abc"`.
7. Tab-separated input → throws shape error (parser treats it as one wide column → fails 12-column check).

### UI (manual)

Run `python3 -m http.server` from `EcoPlate-Analyzer-Web/`, open `http://localhost:8000`, switch to **Load Data** tab.

**Verification checklist (verification-before-completion):**

- [ ] All parser tests pass.
- [ ] Sample fixtures load: enter name, pick `sample_590.csv` and `sample_720.csv`, click Load — grid shows 96 cells with `(590−720)` rounded to 3 decimals.
- [ ] Bad shape: load a 7-row file as OD590 → inline error mentions `OD590` and the shape.
- [ ] Bad value: load a CSV with `"abc"` in a cell → inline error mentions row/column/value.
- [ ] PL-Excel CSV (semicolon + comma decimal) loads correctly.
- [ ] After Load → metadata form fills out → Add Records → record appears in **Edit** and **Filter** tabs (smoke check that downstream is intact).
- [ ] No console errors. No remaining references to `data-loader.js` (`grep` clean).
