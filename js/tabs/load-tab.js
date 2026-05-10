import { parseEcoplateCsv } from '../csv-loader.js';
import { addRecord, getRecords, getUniqueValues } from '../app-state.js';
import { EcoplateRecord } from '../record.js';

let loadedMatrices = null; // array of 3 matrices, each 8x4
let loadedFileName = null;

export function initLoadTab() {
  buildFileSelector();
  buildMetadataForm();
  buildActions();
}

/* ---------- File Selector ---------- */

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

/* ---------- Parse & Render Grid ---------- */

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

function renderGrid(matrices) {
  const container = document.getElementById('ecoplate-grid');
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Build a full 8x12 view from 3 matrices (each 8x4)
  let html = '<h2 class="section-heading">EcoPlate Grid</h2>';
  html += '<div style="overflow-x:auto">';
  html += '<div class="ecoplate-table" style="grid-template-columns: auto repeat(12, 1fr)">';

  // Column headers
  html += '<div class="ecoplate-col-label"></div>'; // corner
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
        : '—';
      html += `<div class="ecoplate-cell" data-col="${c}">${val}</div>`;
    }
  }

  html += '</div></div>';
  container.innerHTML = html;
}

/* ---------- Highlight columns for a sub-matrix ---------- */

function highlightColumns(matrixIndex) {
  const cells = document.querySelectorAll('#ecoplate-grid .ecoplate-cell');
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
  const cells = document.querySelectorAll('#ecoplate-grid .ecoplate-cell');
  cells.forEach(cell => cell.classList.remove('highlighted'));
}

/* ---------- Metadata Form ---------- */

function buildMetadataForm() {
  const container = document.getElementById('metadata-form');
  const panelLabels = ['Section 1 (Cols 1-4)', 'Section 2 (Cols 5-8)', 'Section 3 (Cols 9-12)'];

  let html = '<h2 class="section-heading">Metadata</h2><div class="metadata-grid">';

  for (let i = 0; i < 3; i++) {
    html += `
      <div class="metadata-panel" data-panel="${i}">
        <h3>${panelLabels[i]}</h3>
        <label for="bacteria-${i}">Bacteria</label>
        <input type="text" id="bacteria-${i}" list="bacteria-list" placeholder="Bacteria name">

        <label for="stressor-${i}">Stressor</label>
        <input type="text" id="stressor-${i}" list="stressor-list" placeholder="Stressor type">

        <label for="concentration-${i}">Concentration</label>
        <input type="number" id="concentration-${i}" min="0" step="any" placeholder="0">

        <label for="time-${i}">Time</label>
        <input type="number" id="time-${i}" min="0" step="1" placeholder="0">

        <label style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.6rem">
          <input type="checkbox" id="blank-${i}"> Blank
        </label>

        <label for="repetition-${i}">Repetition</label>
        <input type="number" id="repetition-${i}" min="0" step="1" placeholder="0">
      </div>
    `;
  }

  html += '</div>';
  // Datalists for autocomplete
  html += '<datalist id="bacteria-list"></datalist>';
  html += '<datalist id="stressor-list"></datalist>';
  container.innerHTML = html;

  // Set up highlighting on focus
  for (let i = 0; i < 3; i++) {
    const panel = container.querySelector(`.metadata-panel[data-panel="${i}"]`);
    panel.addEventListener('focusin', () => highlightColumns(i));
    panel.addEventListener('focusout', (e) => {
      // Only clear if focus leaves this panel entirely
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
  const bacteriaList = document.getElementById('bacteria-list');
  const stressorList = document.getElementById('stressor-list');
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

/* ---------- Actions ---------- */

function buildActions() {
  const container = document.getElementById('load-actions');
  container.innerHTML = '<button id="add-records-btn" class="btn btn-primary">Add Records</button>';

  document.getElementById('add-records-btn').addEventListener('click', handleAddRecords);
}

function handleAddRecords() {
  if (!loadedMatrices || loadedMatrices.length < 3) {
    showMessage('Please load a data file first.', 'error');
    return;
  }

  const entries = [];
  const errors = [];

  for (let i = 0; i < 3; i++) {
    const bacteria = document.getElementById(`bacteria-${i}`).value.trim();
    const stressor = document.getElementById(`stressor-${i}`).value.trim();
    const concentrationStr = document.getElementById(`concentration-${i}`).value;
    const timeStr = document.getElementById(`time-${i}`).value;
    const blank = document.getElementById(`blank-${i}`).checked;
    const repetitionStr = document.getElementById(`repetition-${i}`).value;

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

  // Duplicate check among the 3 new records
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (metadataMatch(entries[i], entries[j])) {
        showMessage(`Section ${i + 1} and Section ${j + 1} have identical metadata (bacteria, stressor, concentration, time, repetition).`, 'error');
        return;
      }
    }
  }

  // Duplicate check against existing records
  const existing = getRecords();
  for (let i = 0; i < 3; i++) {
    const e = entries[i];
    for (const rec of existing) {
      if (
        rec.bacteria === e.bacteria &&
        rec.stressor === e.stressor &&
        rec.concentration === e.concentration &&
        rec.time === e.time &&
        rec.repetition === e.repetition
      ) {
        showMessage(`Section ${i + 1}: A record with the same metadata already exists.`, 'error');
        return;
      }

      // Check matching ecoplate matrix values
      if (matricesEqual(rec.ecoplate, loadedMatrices[e.matrixIndex])) {
        showMessage(`Section ${i + 1}: A record with identical ecoplate values already exists.`, 'error');
        return;
      }
    }
  }

  // All valid — create records
  for (const e of entries) {
    const record = new EcoplateRecord({
      bacteria: e.bacteria,
      stressor: e.stressor,
      concentration: e.concentration,
      time: e.time,
      blank: e.blank,
      repetition: e.repetition,
      ecoplate: loadedMatrices[e.matrixIndex],
      fileName: loadedFileName
    });
    addRecord(record);
  }

  updateDataLists();
  showMessage('3 records added successfully!', 'success', 3000);
}

function metadataMatch(a, b) {
  return (
    a.bacteria === b.bacteria &&
    a.stressor === b.stressor &&
    a.concentration === b.concentration &&
    a.time === b.time &&
    a.repetition === b.repetition
  );
}

function matricesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (!a[r] || !b[r] || a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (Number(a[r][c]) !== Number(b[r][c])) return false;
    }
  }
  return true;
}

/* ---------- Messages ---------- */

function showMessage(text, type, autoDismissMs) {
  const container = document.getElementById('load-message');
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
