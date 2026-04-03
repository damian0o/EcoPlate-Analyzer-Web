import { getUniqueValues, getRecords } from '../app-state.js';
import { filterRecords } from '../filter-engine.js';
import { CARBON_SOURCE_MATRIX, CARBON_SOURCE_GROUPS } from '../carbon-sources.js';

/* ---------- Carbon source helpers ---------- */

/** Flat list of all 31 carbon source names (excludes Water at [0][0]) */
function getAllCarbonSources() {
  const sources = [];
  for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
    for (let c = 0; c < CARBON_SOURCE_MATRIX[r].length; c++) {
      if (r === 0 && c === 0) continue; // skip Water
      sources.push(CARBON_SOURCE_MATRIX[r][c]);
    }
  }
  return sources;
}

/** Build a map: carbon source name -> { row, col } in the 8x4 matrix */
function buildSourcePositionMap() {
  const map = {};
  for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
    for (let c = 0; c < CARBON_SOURCE_MATRIX[r].length; c++) {
      map[CARBON_SOURCE_MATRIX[r][c]] = { row: r, col: c };
    }
  }
  return map;
}

const sourcePositionMap = buildSourcePositionMap();

/* ---------- Init ---------- */

export function initFilterTab() {
  buildFilterUI();
}

export function refreshFilterLists() {
  populateFilterList('filter-bacteria', getUniqueValues('bacteria'));
  populateFilterList('filter-stressor', getUniqueValues('stressor'));
  populateFilterList('filter-concentration', getUniqueValues('concentration'));
  populateFilterList('filter-time', getUniqueValues('time'));
  populateFilterList('filter-blank', ['Yes', 'No']);
  populateFilterList('filter-repetition', getUniqueValues('repetition'));
  populateFilterList('filter-carbon-sources', getAllCarbonSources());
  populateFilterList('filter-carbon-groups', Object.keys(CARBON_SOURCE_GROUPS));
}

/* ---------- Build UI ---------- */

function buildFilterUI() {
  const container = document.getElementById('filter-content');

  container.innerHTML = `
    <h2 class="section-heading">Filter Records</h2>
    <div class="filter-row" id="filter-selects">
      ${filterColumn('filter-bacteria', 'Bacteria')}
      ${filterColumn('filter-stressor', 'Stressor')}
      ${filterColumn('filter-concentration', 'Concentration')}
      ${filterColumn('filter-time', 'Time')}
      ${filterColumn('filter-blank', 'Blank')}
      ${filterColumn('filter-repetition', 'Repetition')}
      ${filterColumn('filter-carbon-sources', 'Carbon Sources')}
      ${filterColumn('filter-carbon-groups', 'Carbon Groups')}
    </div>
    <div class="flex gap-1 mb-2">
      <button id="filter-run-btn" class="btn btn-primary">Filter</button>
      <button id="filter-clear-btn" class="btn btn-secondary">Clear Selection</button>
      <button id="filter-save-csv-btn" class="btn btn-secondary" disabled>Save CSV</button>
    </div>
    <div id="filter-message"></div>
    <div id="filter-results"></div>
  `;

  refreshFilterLists();

  document.getElementById('filter-run-btn').addEventListener('click', handleFilter);
  document.getElementById('filter-clear-btn').addEventListener('click', handleClear);
  document.getElementById('filter-save-csv-btn').addEventListener('click', handleSaveCsv);
}

function filterColumn(id, label) {
  return `
    <div class="filter-list">
      <h4>${label}</h4>
      <select id="${id}" multiple size="8" style="width:100%;font-size:0.82rem;border:none;outline:none"></select>
    </div>
  `;
}

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

/* ---------- Helpers ---------- */

function getSelectedValues(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions).map(o => o.value);
}

function showMessage(text, type, autoDismissMs) {
  const container = document.getElementById('filter-message');
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

/* ---------- State for CSV export ---------- */

let lastFilteredRecords = [];
let lastFilterMode = 0;
let lastSelectedSources = [];
let lastSelectedGroups = [];

/* ---------- Filter handler ---------- */

function handleFilter() {
  const selectedSources = getSelectedValues('filter-carbon-sources');
  const selectedGroups = getSelectedValues('filter-carbon-groups');

  // Validate: cannot select both carbon sources AND carbon groups
  if (selectedSources.length > 0 && selectedGroups.length > 0) {
    showMessage('Cannot filter by both Carbon Sources and Carbon Groups at the same time. Please select only one.', 'error');
    return;
  }

  if (getRecords().length === 0) {
    showMessage('No records loaded. Load data first.', 'info');
    return;
  }

  const criteria = {
    bacteria: getSelectedValues('filter-bacteria'),
    stressor: getSelectedValues('filter-stressor'),
    concentration: getSelectedValues('filter-concentration'),
    time: getSelectedValues('filter-time'),
    blank: getSelectedValues('filter-blank'),
    repetition: getSelectedValues('filter-repetition')
  };

  const records = filterRecords(criteria);

  if (records.length === 0) {
    showMessage('No records match the selected criteria.', 'info');
    document.getElementById('filter-results').innerHTML = '';
    document.getElementById('filter-save-csv-btn').disabled = true;
    lastFilteredRecords = [];
    return;
  }

  // Determine display mode
  let mode = 0;
  if (selectedSources.length > 0) mode = 1;
  else if (selectedGroups.length > 0) mode = 2;

  lastFilteredRecords = records;
  lastFilterMode = mode;
  lastSelectedSources = selectedSources;
  lastSelectedGroups = selectedGroups;

  renderResults(records, mode, selectedSources, selectedGroups);
  document.getElementById('filter-save-csv-btn').disabled = false;
  showMessage(`Found ${records.length} matching record(s).`, 'success', 3000);
}

/* ---------- Clear ---------- */

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

/* ---------- Render results ---------- */

function renderResults(records, mode, selectedSources, selectedGroups) {
  const container = document.getElementById('filter-results');
  let html = '';

  for (const rec of records) {
    html += `<div class="record-card">`;
    html += renderRecordMeta(rec);

    if (mode === 0) {
      html += renderFullEcoplateTable(rec);
    } else if (mode === 1) {
      html += renderCarbonSourcesTable(rec, selectedSources);
    } else if (mode === 2) {
      html += renderCarbonGroupsTable(rec, selectedGroups);
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

function renderRecordMeta(rec) {
  return `
    <div class="card-title">${escapeHtml(rec.bacteria)} &mdash; ${escapeHtml(rec.stressor)}</div>
    <div class="card-meta">
      Concentration: ${rec.concentration} | Time: ${rec.time} | Blank: ${rec.blank ? 'Yes' : 'No'} | Repetition: ${rec.repetition} | File: ${escapeHtml(rec.fileName)}
    </div>
  `;
}

function renderFullEcoplateTable(rec) {
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let html = '<table class="results-table mt-1"><thead><tr><th></th>';
  for (let c = 1; c <= 4; c++) html += `<th>${c}</th>`;
  html += '</tr></thead><tbody>';

  for (let r = 0; r < 8; r++) {
    html += `<tr><td><strong>${rowLabels[r]}</strong></td>`;
    for (let c = 0; c < 4; c++) {
      const val = rec.ecoplate[r] ? Number(rec.ecoplate[r][c]).toFixed(3) : '\u2014';
      html += `<td>${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderCarbonSourcesTable(rec, selectedSources) {
  let html = '<table class="results-table mt-1"><thead><tr><th>Carbon Source</th><th>Value</th></tr></thead><tbody>';

  for (const name of selectedSources) {
    const pos = sourcePositionMap[name];
    let val = '\u2014';
    if (pos && rec.ecoplate[pos.row]) {
      val = Number(rec.ecoplate[pos.row][pos.col]).toFixed(3);
    }
    html += `<tr><td>${escapeHtml(name)}</td><td>${val}</td></tr>`;
  }

  html += '</tbody></table>';
  return html;
}

function renderCarbonGroupsTable(rec, selectedGroups) {
  let html = '<table class="results-table mt-1"><thead><tr><th>Group</th><th>Carbon Source</th><th>Value</th></tr></thead><tbody>';

  for (const group of selectedGroups) {
    const sources = CARBON_SOURCE_GROUPS[group] || [];
    for (const name of sources) {
      const pos = sourcePositionMap[name];
      let val = '\u2014';
      if (pos && rec.ecoplate[pos.row]) {
        val = Number(rec.ecoplate[pos.row][pos.col]).toFixed(3);
      }
      html += `<tr><td>${escapeHtml(group)}</td><td>${escapeHtml(name)}</td><td>${val}</td></tr>`;
    }
  }

  html += '</tbody></table>';
  return html;
}

/* ---------- CSV Export ---------- */

function handleSaveCsv() {
  if (lastFilteredRecords.length === 0) return;

  let csvContent = '';

  if (lastFilterMode === 0) {
    csvContent = buildFullCsv(lastFilteredRecords);
  } else if (lastFilterMode === 1) {
    csvContent = buildSourcesCsv(lastFilteredRecords, lastSelectedSources);
  } else if (lastFilterMode === 2) {
    csvContent = buildGroupsCsv(lastFilteredRecords, lastSelectedGroups);
  }

  downloadCsv(csvContent, 'ecoplate-filtered.csv');
}

function buildFullCsv(records) {
  const headers = ['Bacteria', 'Stressor', 'Concentration', 'Time', 'Blank', 'Repetition', 'File'];
  // Add column headers for all 8x4 positions
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      headers.push(CARBON_SOURCE_MATRIX[r][c]);
    }
  }

  const rows = [headers.join(',')];

  for (const rec of records) {
    const meta = [
      csvEscape(rec.bacteria),
      csvEscape(rec.stressor),
      rec.concentration,
      rec.time,
      rec.blank ? 'Yes' : 'No',
      rec.repetition,
      csvEscape(rec.fileName)
    ];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 4; c++) {
        meta.push(rec.ecoplate[r] ? Number(rec.ecoplate[r][c]).toFixed(3) : '');
      }
    }
    rows.push(meta.join(','));
  }

  return rows.join('\n');
}

function buildSourcesCsv(records, selectedSources) {
  const headers = ['Bacteria', 'Stressor', 'Concentration', 'Time', 'Blank', 'Repetition', 'File'];
  for (const name of selectedSources) headers.push(name);

  const rows = [headers.map(csvEscape).join(',')];

  for (const rec of records) {
    const meta = [
      csvEscape(rec.bacteria),
      csvEscape(rec.stressor),
      rec.concentration,
      rec.time,
      rec.blank ? 'Yes' : 'No',
      rec.repetition,
      csvEscape(rec.fileName)
    ];
    for (const name of selectedSources) {
      const pos = sourcePositionMap[name];
      meta.push(pos && rec.ecoplate[pos.row] ? Number(rec.ecoplate[pos.row][pos.col]).toFixed(3) : '');
    }
    rows.push(meta.join(','));
  }

  return rows.join('\n');
}

function buildGroupsCsv(records, selectedGroups) {
  const headers = ['Bacteria', 'Stressor', 'Concentration', 'Time', 'Blank', 'Repetition', 'File', 'Group', 'Carbon Source', 'Value'];
  const rows = [headers.map(csvEscape).join(',')];

  for (const rec of records) {
    for (const group of selectedGroups) {
      const sources = CARBON_SOURCE_GROUPS[group] || [];
      for (const name of sources) {
        const pos = sourcePositionMap[name];
        const val = pos && rec.ecoplate[pos.row] ? Number(rec.ecoplate[pos.row][pos.col]).toFixed(3) : '';
        rows.push([
          csvEscape(rec.bacteria),
          csvEscape(rec.stressor),
          rec.concentration,
          rec.time,
          rec.blank ? 'Yes' : 'No',
          rec.repetition,
          csvEscape(rec.fileName),
          csvEscape(group),
          csvEscape(name),
          val
        ].join(','));
      }
    }
  }

  return rows.join('\n');
}

function csvEscape(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
