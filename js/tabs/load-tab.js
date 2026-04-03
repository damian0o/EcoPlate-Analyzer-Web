import { fetchIndex, fetchExperiment } from '../data-loader.js';
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
    <div class="flex gap-1" style="align-items:center">
      <select id="file-select" style="max-width:400px">
        <option value="">Loading files...</option>
      </select>
      <button id="load-file-btn" class="btn btn-primary" disabled>Load</button>
    </div>
  `;

  const select = document.getElementById('file-select');
  const loadBtn = document.getElementById('load-file-btn');

  fetchIndex()
    .then(index => {
      const files = index.files || index;
      select.innerHTML = '<option value="">-- Choose a file --</option>';
      (Array.isArray(files) ? files : []).forEach(f => {
        const name = typeof f === 'string' ? f : f.name || f.filename;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
      loadBtn.disabled = false;
    })
    .catch(() => {
      select.innerHTML = '<option value="">Failed to load file list</option>';
      showMessage('Failed to fetch data index. Check your connection.', 'error');
    });

  select.addEventListener('change', () => {
    loadBtn.disabled = !select.value;
  });

  loadBtn.addEventListener('click', () => {
    const filename = select.value;
    if (!filename) return;
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    fetchExperiment(filename)
      .then(data => {
        parseAndRenderGrid(data, filename);
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
      })
      .catch(() => {
        showMessage(`Failed to fetch ${filename}`, 'error');
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
      });
  });
}

/* ---------- Parse & Render Grid ---------- */

function parseAndRenderGrid(data, filename) {
  // data.matrices is expected to be an array of 3 matrices, each 8 rows x 4 cols
  // OR data itself is { matrices: [...] } or an array of 3 matrices
  let matrices;
  if (Array.isArray(data)) {
    matrices = data;
  } else if (data.matrices) {
    matrices = data.matrices;
  } else if (data.data) {
    matrices = data.data;
  } else {
    // Attempt: data is a single 8x12 matrix; split into 3 sub-matrices of 8x4
    const keys = Object.keys(data);
    if (keys.length > 0 && Array.isArray(data[keys[0]])) {
      matrices = [data];
    } else {
      showMessage('Unrecognized data format', 'error');
      return;
    }
  }

  // If we got a single 8x12 matrix, split it
  if (matrices.length === 1 && matrices[0].length === 8 && matrices[0][0].length === 12) {
    const full = matrices[0];
    matrices = [
      full.map(row => row.slice(0, 4)),
      full.map(row => row.slice(4, 8)),
      full.map(row => row.slice(8, 12))
    ];
  } else if (matrices.length >= 8 && Array.isArray(matrices[0]) && matrices[0].length === 12) {
    // It's a flat 8x12 matrix
    const full = matrices;
    matrices = [
      full.map(row => row.slice(0, 4)),
      full.map(row => row.slice(4, 8)),
      full.map(row => row.slice(8, 12))
    ];
  }

  loadedMatrices = matrices;
  loadedFileName = filename;
  renderGrid(matrices);
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
