import { getRecords, getUniqueValues, removeRecord, addRecord } from '../app-state.js';
import { EcoplateRecord } from '../record.js';

let editMatrices = null; // array of 3 matrices (8x4 each) for the selected file

export function initEditTab() {
  buildEditUI();
}

export function refreshEditDropdown() {
  const select = document.getElementById('edit-file-select');
  if (!select) return;
  const filenames = getUniqueValues('filename');
  const prev = select.value;
  select.innerHTML = '<option value="">-- Choose a dataset --</option>';
  filenames.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    select.appendChild(opt);
  });
  // Restore previous selection if still available
  if (filenames.includes(prev)) {
    select.value = prev;
  }
}

/* ---------- Build UI ---------- */

function buildEditUI() {
  const container = document.getElementById('edit-content');
  container.innerHTML = `
    <h2 class="section-heading">Edit / Delete Dataset</h2>
    <div class="flex gap-1" style="align-items:center;margin-bottom:1rem">
      <select id="edit-file-select" style="max-width:400px">
        <option value="">-- Choose a dataset --</option>
      </select>
      <button id="edit-show-btn" class="btn btn-primary" disabled>Show</button>
      <button id="edit-delete-btn" class="btn btn-danger" disabled>Delete</button>
    </div>
    <div id="edit-grid"></div>
    <div id="edit-metadata-form"></div>
    <div id="edit-actions" style="margin:1rem 0;display:flex;gap:0.5rem;flex-wrap:wrap"></div>
    <div id="edit-message"></div>
  `;

  refreshEditDropdown();

  const select = document.getElementById('edit-file-select');
  const showBtn = document.getElementById('edit-show-btn');
  const deleteBtn = document.getElementById('edit-delete-btn');

  select.addEventListener('change', () => {
    const hasVal = !!select.value;
    showBtn.disabled = !hasVal;
    deleteBtn.disabled = !hasVal;
  });

  showBtn.addEventListener('click', handleShow);
  deleteBtn.addEventListener('click', handleDelete);
}

/* ---------- Show ---------- */

function handleShow() {
  const filename = document.getElementById('edit-file-select').value;
  if (!filename) return;

  const records = getRecords().filter(r => r.fileName === filename);
  if (records.length === 0) {
    showMessage('No records found for this file.', 'error');
    return;
  }

  // Expect 3 records per file
  editMatrices = records.map(r => r.ecoplate);
  renderGrid(editMatrices);
  renderMetadataForm(records);
  renderUpdateButton();
}

/* ---------- Grid rendering ---------- */

function renderGrid(matrices) {
  const container = document.getElementById('edit-grid');
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  let html = '<h2 class="section-heading">EcoPlate Grid</h2>';
  html += '<div style="overflow-x:auto">';
  html += '<div class="ecoplate-table" style="grid-template-columns: auto repeat(12, 1fr)">';

  // Column headers
  html += '<div class="ecoplate-col-label"></div>';
  for (let c = 1; c <= 12; c++) {
    html += `<div class="ecoplate-col-label">${c}</div>`;
  }

  // Data rows
  for (let r = 0; r < 8; r++) {
    html += `<div class="ecoplate-row-label">${rowLabels[r]}</div>`;
    for (let c = 0; c < 12; c++) {
      const matIdx = Math.floor(c / 4);
      const colIdx = c % 4;
      const val = matrices[matIdx] && matrices[matIdx][r]
        ? Number(matrices[matIdx][r][colIdx]).toFixed(3)
        : '\u2014';
      html += `<div class="ecoplate-cell" data-col="${c}">${val}</div>`;
    }
  }

  html += '</div></div>';
  container.innerHTML = html;
}

/* ---------- Highlight columns ---------- */

function highlightColumns(matrixIndex) {
  const cells = document.querySelectorAll('#edit-grid .ecoplate-cell');
  const startCol = matrixIndex * 4;
  const endCol = startCol + 3;
  cells.forEach(cell => {
    const col = Number(cell.dataset.col);
    if (!isNaN(col)) {
      cell.classList.toggle('highlighted', col >= startCol && col <= endCol);
    }
  });
}

function clearHighlights() {
  const cells = document.querySelectorAll('#edit-grid .ecoplate-cell');
  cells.forEach(cell => cell.classList.remove('highlighted'));
}

/* ---------- Metadata Form ---------- */

function renderMetadataForm(records) {
  const container = document.getElementById('edit-metadata-form');
  const panelLabels = ['Section 1 (Cols 1-4)', 'Section 2 (Cols 5-8)', 'Section 3 (Cols 9-12)'];

  let html = '<h2 class="section-heading">Metadata</h2><div class="metadata-grid">';

  for (let i = 0; i < 3; i++) {
    const rec = records[i] || {};
    html += `
      <div class="metadata-panel" data-panel="${i}">
        <h3>${panelLabels[i]}</h3>
        <label for="edit-bacteria-${i}">Bacteria</label>
        <input type="text" id="edit-bacteria-${i}" list="edit-bacteria-list" placeholder="Bacteria name" value="${escapeAttr(rec.bacteria || '')}">

        <label for="edit-stressor-${i}">Stressor</label>
        <input type="text" id="edit-stressor-${i}" list="edit-stressor-list" placeholder="Stressor type" value="${escapeAttr(rec.stressor || '')}">

        <label for="edit-concentration-${i}">Concentration</label>
        <input type="number" id="edit-concentration-${i}" min="0" step="any" placeholder="0" value="${rec.concentration != null ? rec.concentration : ''}">

        <label for="edit-time-${i}">Time</label>
        <input type="number" id="edit-time-${i}" min="0" step="1" placeholder="0" value="${rec.time != null ? rec.time : ''}">

        <label style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.6rem">
          <input type="checkbox" id="edit-blank-${i}" ${rec.blank ? 'checked' : ''}> Blank
        </label>

        <label for="edit-repetition-${i}">Repetition</label>
        <input type="number" id="edit-repetition-${i}" min="0" step="1" placeholder="0" value="${rec.repetition != null ? rec.repetition : ''}">
      </div>
    `;
  }

  html += '</div>';
  html += '<datalist id="edit-bacteria-list"></datalist>';
  html += '<datalist id="edit-stressor-list"></datalist>';
  container.innerHTML = html;

  // Set up highlighting on focus
  for (let i = 0; i < 3; i++) {
    const panel = container.querySelector(`.metadata-panel[data-panel="${i}"]`);
    panel.addEventListener('focusin', () => highlightColumns(i));
    panel.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!panel.contains(document.activeElement)) {
          clearHighlights();
        }
      }, 10);
    });
  }

  updateDataLists();
}

function updateDataLists() {
  const bacteriaList = document.getElementById('edit-bacteria-list');
  const stressorList = document.getElementById('edit-stressor-list');
  if (!bacteriaList || !stressorList) return;

  bacteriaList.innerHTML = '';
  stressorList.innerHTML = '';

  getUniqueValues('bacteria').forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    bacteriaList.appendChild(opt);
  });

  getUniqueValues('stressor').forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    stressorList.appendChild(opt);
  });
}

/* ---------- Update Button ---------- */

function renderUpdateButton() {
  const container = document.getElementById('edit-actions');
  container.innerHTML = '<button id="edit-update-btn" class="btn btn-primary">Update Records</button>';
  document.getElementById('edit-update-btn').addEventListener('click', handleUpdate);
}

function handleUpdate() {
  const filename = document.getElementById('edit-file-select').value;
  if (!filename || !editMatrices) {
    showMessage('No dataset loaded for editing.', 'error');
    return;
  }

  const entries = [];
  const errors = [];

  for (let i = 0; i < 3; i++) {
    const bacteria = document.getElementById(`edit-bacteria-${i}`).value.trim();
    const stressor = document.getElementById(`edit-stressor-${i}`).value.trim();
    const concentrationStr = document.getElementById(`edit-concentration-${i}`).value;
    const timeStr = document.getElementById(`edit-time-${i}`).value;
    const blank = document.getElementById(`edit-blank-${i}`).checked;
    const repetitionStr = document.getElementById(`edit-repetition-${i}`).value;

    const label = `Section ${i + 1}`;

    if (!bacteria) errors.push(`${label}: Bacteria is required`);
    if (!stressor) errors.push(`${label}: Stressor is required`);

    const concentration = Number(concentrationStr);
    if (concentrationStr === '' || isNaN(concentration) || concentration < 0) {
      errors.push(`${label}: Concentration must be a number >= 0`);
    }

    const time = Number(timeStr);
    if (timeStr === '' || !Number.isInteger(time) || time < 0) {
      errors.push(`${label}: Time must be an integer >= 0`);
    }

    const repetition = Number(repetitionStr);
    if (repetitionStr === '' || !Number.isInteger(repetition) || repetition < 0) {
      errors.push(`${label}: Repetition must be an integer >= 0`);
    }

    entries.push({ bacteria, stressor, concentration, time, blank, repetition, matrixIndex: i });
  }

  if (errors.length > 0) {
    showMessage(errors.join('<br>'), 'error');
    return;
  }

  // Remove old records for this filename
  const oldRecords = getRecords().filter(r => r.fileName === filename);
  oldRecords.forEach(r => removeRecord(r));

  // Create new records
  for (const e of entries) {
    const record = new EcoplateRecord({
      bacteria: e.bacteria,
      stressor: e.stressor,
      concentration: e.concentration,
      time: e.time,
      blank: e.blank,
      repetition: e.repetition,
      ecoplate: editMatrices[e.matrixIndex],
      fileName: filename
    });
    addRecord(record);
  }

  updateDataLists();
  refreshEditDropdown();
  showMessage('Records updated successfully!', 'success', 3000);
}

/* ---------- Delete ---------- */

function handleDelete() {
  const filename = document.getElementById('edit-file-select').value;
  if (!filename) return;

  if (!confirm(`Delete all records for "${filename}"? This cannot be undone.`)) return;

  const records = getRecords().filter(r => r.fileName === filename);
  records.forEach(r => removeRecord(r));

  // Clear the displayed content
  editMatrices = null;
  document.getElementById('edit-grid').innerHTML = '';
  document.getElementById('edit-metadata-form').innerHTML = '';
  document.getElementById('edit-actions').innerHTML = '';

  refreshEditDropdown();
  document.getElementById('edit-show-btn').disabled = true;
  document.getElementById('edit-delete-btn').disabled = true;
  showMessage(`All records for "${filename}" deleted.`, 'success', 3000);
}

/* ---------- Helpers ---------- */

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showMessage(text, type, autoDismissMs) {
  const container = document.getElementById('edit-message');
  container.innerHTML = `<div class="message ${type}">${text}</div>`;

  if (autoDismissMs) {
    setTimeout(() => {
      const msg = container.querySelector('.message');
      if (msg) {
        msg.classList.add('fade-out');
        msg.addEventListener('animationend', () => msg.remove());
      }
    }, autoDismissMs);
  }
}
