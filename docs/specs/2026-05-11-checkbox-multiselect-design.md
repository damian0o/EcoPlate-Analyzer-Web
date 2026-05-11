# Checkbox Multi-Select for Filter Lists — Design

**Date:** 2026-05-11
**Scope:** EcoPlate-Analyzer-Web
**Source:** `docs/2026-05-07-review.md`, point 3

## Goal

Replace the native `<select multiple size="8">` listboxes used in **Tests** and **Filter** tabs with a checkbox list, so that a plain click toggles a single item without requiring Ctrl/Cmd-click. The current native listbox replaces the entire selection on a plain click, which makes deselecting a single item impossible without a modifier key — a UX pain point on point 3 of the review.

## Non-goals

- Extracting a shared `filter-list.js` module — the helpers are currently duplicated between `tests-tab.js` and `filter-tab.js`; consolidation is a separate refactor.
- "Select all" / "Clear all" controls — out of scope for the bug fix.
- Search-as-you-type inside long lists — out of scope.
- Touch gesture support beyond what the browser provides natively for `<input type="checkbox">`.

## Change set

### `js/tabs/tests-tab.js` (and identical change in `js/tabs/filter-tab.js`)

1. **`filterColumn(id, label)`** returns a `<div class="checkbox-list">` container instead of a `<select multiple>`.

   ```html
   <div class="filter-list">
     <h4>${label}</h4>
     <div id="${id}" class="checkbox-list"></div>
   </div>
   ```

2. **`populateFilterList(containerId, values)`** rebuilds the checkbox rows, preserving previously checked values:

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

3. **`getSelectedValues(containerId)`** reads checkbox state:

   ```javascript
   function getSelectedValues(containerId) {
     const container = document.getElementById(containerId);
     if (!container) return [];
     return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
   }
   ```

The parameter name changes semantically from `selectId` to `containerId`, but everywhere these helpers are called by ID the call sites are unchanged.

### `css/style.css`

Append the following block (or place it near the existing `.filter-list` styles for locality):

```css
.checkbox-list {
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: #fff;
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

The `max-height: 12rem` mimics the old `size="8"` viewport at this font size; scroll engages for longer lists (Carbon Sources has 31 items).

## API surface stability

The public surface of these three functions (call signatures and return types) is unchanged. `runTest`, `applyFilter`, `refreshTestsLists`, CSV export, and chart rendering continue to read selections via `getSelectedValues(id)` and receive the same `string[]`.

## Behavior matrix

| Action | Old (native `<select multiple>`) | New (checkbox list) |
|---|---|---|
| Click unchecked item | Selects only this item, deselects all others | Toggles only this item ON; others unchanged |
| Click checked item | Usually no change (or "select only this") | Toggles only this item OFF; others unchanged |
| Ctrl/Cmd+click | Toggles single item | Same as plain click (modifier ignored) |
| Shift+click range | Range select | No range select (acceptable scope reduction) |
| Keyboard: Tab to focus | Focuses select element | Focuses first checkbox |
| Keyboard: Space | Toggles focused option | Toggles focused checkbox |
| Re-render (`populateFilterList`) | Preserves selected by `selectedOptions` | Preserves selected by checking input states |

## Testing

No automated test framework for tabs — manual verification only.

**Checklist:**

- Tests tab → `Bacteria` list: click an item → it becomes checked. Click again → unchecks. (Core fix.)
- Tests tab → `Bacteria` list: click three items → all three remain checked, no Ctrl needed.
- Tests tab → `Carbon Sources` (31 items): vertical scroll works inside the list; clicks still toggle correctly after scrolling.
- Filter tab → all 8 lists exhibit the same toggle behavior.
- Run AWCD/SAWCD/Shannon/Evenness after a selection — values compute correctly (confirms `getSelectedValues` still returns the right strings).
- Filter tab: after a selection, the records list and CSV export reflect the same subset as before.
- After adding a new record on Load Data → switch to Tests → `refreshTestsLists()` repopulates lists and preserves previously-checked items.
- No browser console errors or warnings during any of the above.
