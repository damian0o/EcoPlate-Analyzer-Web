# Integer-only Concentration — Design

**Date:** 2026-05-10
**Scope:** EcoPlate-Analyzer-Web
**Source:** `docs/2026-05-07-review.md`, point 2

## Goal

Constrain the **Concentration** field to non-negative integers (zero included) in both the **Load Data** and **Edit** tabs. The **Time** field already enforces this constraint and is unchanged. **Repetition** also already enforces it.

## Non-goals

- Persistence migration — records live in-memory and disappear on reload; no stored decimals to handle.
- Filter tab — Concentration there is a selection over already-recorded values, not user input, so no validation needed.
- Extracting a shared validator helper — out of scope for this fix; codebase already duplicates load/edit patterns and a refactor is a separate effort.

## Change set

### `js/tabs/load-tab.js`

1. Input attribute — in `buildMetadataForm()`, the concentration `<input>` element:

   ```html
   <input type="number" id="concentration-${i}" min="0" step="any" placeholder="0">
   ```

   becomes:

   ```html
   <input type="number" id="concentration-${i}" min="0" step="1" placeholder="0">
   ```

2. Validation — in `handleAddRecords()`, the concentration validation block:

   ```javascript
   const concentration = Number(concentrationStr);
   if (concentrationStr === '' || isNaN(concentration) || concentration < 0) {
     errors.push(`${label}: Concentration must be a number >= 0`);
   }
   ```

   becomes:

   ```javascript
   const concentration = Number(concentrationStr);
   if (concentrationStr === '' || !Number.isInteger(concentration) || concentration < 0) {
     errors.push(`${label}: Concentration must be an integer >= 0`);
   }
   ```

### `js/tabs/edit-tab.js`

The exact same two changes (different IDs prefixed with `edit-`):

1. `step="any"` → `step="1"` on the `edit-concentration-${i}` input.
2. Validation block in `handleUpdate()` (around line 242) gets the same `!Number.isInteger` guard and updated error message.

## Behavior matrix

| Input value | Old behavior | New behavior |
|---|---|---|
| `0` | accepted | accepted |
| `5` | accepted | accepted |
| `2.5` | accepted | rejected — `Concentration must be an integer >= 0` |
| `0.5` | accepted | rejected (same) |
| `-1` | rejected | rejected (same message wording updated) |
| (empty) | rejected | rejected (same) |
| `abc` | rejected (NaN) | rejected (`Number.isInteger(NaN)` is false) |

The browser-level `step="1"` makes the number-input spinner increment by 1 and adds a native validity hint when a decimal is typed; it does NOT prevent typing decimals manually, so the JS guard is the authoritative check.

## Record model

`EcoplateRecord` constructor (`js/record.js`) still calls `Number(concentration)` on the input. No change — the integer guarantee is enforced upstream at the form layer (mirroring how `time` is handled today).

## Testing

No automated test framework in the project for tab handlers — verification is manual:

- Load Data tab: try `2.5` → error message; try `0` → accepted; try `5` → accepted; try `-1` → error; try empty → error.
- Edit tab: load a record (use Add Records on a previously loaded experiment), edit Concentration to `2.5` → error; to integer → saves.
- Spinner step: arrow keys on the number input step by 1.
- No console errors during any of the above.
