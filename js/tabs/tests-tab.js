import { getUniqueValues, getRecords } from '../app-state.js';
import { filterRecords } from '../filter-engine.js';
import { CARBON_SOURCE_MATRIX, CARBON_SOURCE_GROUPS } from '../carbon-sources.js';
import { calculateAWCD, calculateSAWCD, calculateShannonIndex, calculateShannonEvenness } from '../statistics.js';
import { renderGroupedBarChart, renderStackedBarChart, saveChartAsPNG } from '../charts.js';

/* ---------- Carbon source helpers ---------- */

function getAllCarbonSources() {
  const sources = [];
  for (let r = 0; r < CARBON_SOURCE_MATRIX.length; r++) {
    for (let c = 0; c < CARBON_SOURCE_MATRIX[r].length; c++) {
      if (r === 0 && c === 0) continue;
      sources.push(CARBON_SOURCE_MATRIX[r][c]);
    }
  }
  return sources;
}

/* ---------- Init ---------- */

export function initTestsTab() {
  buildTestsUI();
}

export function refreshTestsLists() {
  populateFilterList('tests-bacteria', getUniqueValues('bacteria'));
  populateFilterList('tests-stressor', getUniqueValues('stressor'));
  populateFilterList('tests-concentration', getUniqueValues('concentration'));
  populateFilterList('tests-time', getUniqueValues('time'));
  populateFilterList('tests-blank', ['Yes', 'No']);
  populateFilterList('tests-repetition', getUniqueValues('repetition'));
  populateFilterList('tests-carbon-sources', getAllCarbonSources());
  populateFilterList('tests-carbon-groups', Object.keys(CARBON_SOURCE_GROUPS));
}

/* ---------- Build UI ---------- */

function buildTestsUI() {
  const container = document.getElementById('tests-content');

  container.innerHTML = `
    <h2 class="section-heading">Statistical Tests</h2>
    <div class="filter-row" id="tests-selects">
      ${filterColumn('tests-bacteria', 'Bacteria')}
      ${filterColumn('tests-stressor', 'Stressor')}
      ${filterColumn('tests-concentration', 'Concentration')}
      ${filterColumn('tests-time', 'Time')}
      ${filterColumn('tests-blank', 'Blank')}
      ${filterColumn('tests-repetition', 'Repetition')}
      ${filterColumn('tests-carbon-sources', 'Carbon Sources')}
      ${filterColumn('tests-carbon-groups', 'Carbon Groups')}
    </div>
    <div class="flex gap-1 mb-2 flex-wrap">
      <button id="tests-awcd-btn" class="btn btn-primary">AWCD</button>
      <button id="tests-sawcd-btn" class="btn btn-primary">SAWCD</button>
      <button id="tests-shannon-btn" class="btn btn-primary">Shannon Index</button>
      <button id="tests-evenness-btn" class="btn btn-primary">Shannon Evenness</button>
    </div>
    <div id="tests-message"></div>
    <div id="tests-results"></div>
    <div class="chart-container hidden" id="tests-chart-container">
      <canvas id="tests-chart-canvas"></canvas>
    </div>
    <div class="flex gap-1 mt-2 hidden" id="tests-actions">
      <button id="tests-save-csv-btn" class="btn btn-secondary">Save CSV</button>
      <button id="tests-save-graph-btn" class="btn btn-secondary">Save Graph as PNG</button>
    </div>
  `;

  refreshTestsLists();

  document.getElementById('tests-awcd-btn').addEventListener('click', () => runTest('awcd'));
  document.getElementById('tests-sawcd-btn').addEventListener('click', () => runTest('sawcd'));
  document.getElementById('tests-shannon-btn').addEventListener('click', () => runTest('shannon'));
  document.getElementById('tests-evenness-btn').addEventListener('click', () => runTest('evenness'));
  document.getElementById('tests-save-csv-btn').addEventListener('click', handleSaveCsv);
  document.getElementById('tests-save-graph-btn').addEventListener('click', handleSaveGraph);
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
  const container = document.getElementById('tests-message');
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

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

/* ---------- State ---------- */

let lastTestType = null;
let lastResults = [];       // computed rows for CSV
let lastChartTitle = '';

/* ---------- Run test ---------- */

function runTest(type) {
  if (getRecords().length === 0) {
    showMessage('No records loaded. Load data first.', 'info');
    return;
  }

  const selectedSources = getSelectedValues('tests-carbon-sources');
  const selectedGroups = getSelectedValues('tests-carbon-groups');

  // For SAWCD, need carbon groups
  if (type === 'sawcd' && selectedGroups.length === 0) {
    showMessage('Please select at least one Carbon Group for SAWCD calculation.', 'error');
    return;
  }

  if (selectedSources.length > 0 && selectedGroups.length > 0) {
    showMessage('Cannot filter by both Carbon Sources and Carbon Groups at the same time.', 'error');
    return;
  }

  const criteria = {
    bacteria: getSelectedValues('tests-bacteria'),
    stressor: getSelectedValues('tests-stressor'),
    concentration: getSelectedValues('tests-concentration'),
    time: getSelectedValues('tests-time'),
    blank: getSelectedValues('tests-blank'),
    repetition: getSelectedValues('tests-repetition')
  };

  const records = filterRecords(criteria);

  if (records.length === 0) {
    showMessage('No records match the selected criteria.', 'info');
    document.getElementById('tests-results').innerHTML = '';
    document.getElementById('tests-chart-container').classList.add('hidden');
    document.getElementById('tests-actions').classList.add('hidden');
    lastResults = [];
    return;
  }

  // Calculate statistics for all records at once
  const results = [];

  if (type === 'sawcd') {
    const groupNames = selectedGroups.length > 0
      ? selectedGroups
      : Object.keys(CARBON_SOURCE_GROUPS);

    for (const rec of records) {
      for (const group of groupNames) {
        const sources = CARBON_SOURCE_GROUPS[group] || [];
        const value = calculateSAWCD(rec.ecoplate, sources);
        results.push({
          bacteria: rec.bacteria,
          stressor: rec.stressor,
          concentration: rec.concentration,
          time: rec.time,
          blank: rec.blank,
          repetition: rec.repetition,
          category: group,
          value
        });
      }
    }
  } else {
    const calcFn = type === 'awcd' ? calculateAWCD
      : type === 'shannon' ? calculateShannonIndex
      : calculateShannonEvenness;

    for (const rec of records) {
      results.push({
        bacteria: rec.bacteria,
        stressor: rec.stressor,
        concentration: rec.concentration,
        time: rec.time,
        blank: rec.blank,
        repetition: rec.repetition,
        value: calcFn(rec.ecoplate)
      });
    }
  }

  lastTestType = type;
  lastResults = results;

  renderResultsTable(results, type);

  // Render chart
  const canvas = document.getElementById('tests-chart-canvas');
  document.getElementById('tests-chart-container').classList.remove('hidden');
  document.getElementById('tests-actions').classList.remove('hidden');

  if (type === 'sawcd') {
    renderSAWCDChart(canvas, results);
  } else {
    renderGroupedChart(canvas, results, type);
  }

  showMessage(`Calculated ${typeLabel(type)} for ${records.length} record(s).`, 'success', 3000);
}

/* ---------- Render results table ---------- */

function renderResultsTable(results, type) {
  const container = document.getElementById('tests-results');
  const label = typeLabel(type);

  const isSawcd = type === 'sawcd';
  let html = '<table class="results-table"><thead><tr>';
  html += '<th>Bacteria</th><th>Stressor</th><th>Concentration</th><th>Time</th><th>Repetition</th>';
  if (isSawcd) html += '<th>Category</th>';
  html += `<th>${escapeHtml(label)}</th>`;
  html += '</tr></thead><tbody>';

  for (const r of results) {
    html += '<tr>';
    html += `<td>${escapeHtml(r.bacteria)}</td>`;
    html += `<td>${escapeHtml(r.stressor)}</td>`;
    html += `<td>${r.blank ? 'Blank' : r.concentration}</td>`;
    html += `<td>${r.time}</td>`;
    html += `<td>${r.repetition}</td>`;
    if (isSawcd) html += `<td>${escapeHtml(r.category)}</td>`;
    html += `<td>${r.value.toFixed(4)}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ---------- Chart rendering ---------- */

function renderGroupedChart(canvas, results, type) {
  // Group results by concentration and time
  // Average values when multiple records share (concentration, time)
  const groups = {};
  for (const r of results) {
    const concLabel = r.blank ? 'Blank' : String(r.concentration);
    const timeLabel = String(r.time);
    const key = `${concLabel}||${timeLabel}`;
    if (!groups[key]) groups[key] = { concLabel, timeLabel, values: [] };
    groups[key].values.push(r.value);
  }

  // Collect unique concentrations and times
  const concSet = new Set();
  const timeSet = new Set();
  for (const g of Object.values(groups)) {
    concSet.add(g.concLabel);
    timeSet.add(g.timeLabel);
  }

  // Sort concentrations: Blank first, then numeric
  const concentrations = [...concSet].sort((a, b) => {
    if (a === 'Blank') return -1;
    if (b === 'Blank') return 1;
    return Number(a) - Number(b);
  });

  const times = [...timeSet].sort((a, b) => Number(a) - Number(b));

  const label = typeLabel(type);
  const datasets = times.map(t => ({
    label: `${t} hours`,
    data: concentrations.map(c => {
      const key = `${c}||${t}`;
      const g = groups[key];
      if (!g) return 0;
      return g.values.reduce((a, b) => a + b, 0) / g.values.length;
    })
  }));

  lastChartTitle = label;
  renderGroupedBarChart(canvas, {
    labels: concentrations,
    datasets,
    xLabel: 'Concentration',
    yLabel: label,
    title: label
  });
}

function renderSAWCDChart(canvas, results) {
  // Group by (concentration, time) pairs
  // For each pair, calculate SAWCD percentage per carbon source group
  const pairMap = {};
  for (const r of results) {
    const concLabel = r.blank ? 'Blank' : String(r.concentration);
    const timeLabel = String(r.time);
    const pairKey = `${timeLabel} h\n${concLabel} ppm`;
    if (!pairMap[pairKey]) pairMap[pairKey] = {};
    if (!pairMap[pairKey][r.category]) pairMap[pairKey][r.category] = [];
    pairMap[pairKey][r.category].push(r.value);
  }

  const pairLabels = Object.keys(pairMap);
  const allGroups = [...new Set(results.map(r => r.category))];

  // Average values and normalize to percentages
  const datasets = allGroups.map(group => ({
    label: group,
    data: pairLabels.map(pair => {
      const catMap = pairMap[pair];
      // Average per group
      const vals = catMap[group] || [0];
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

      // Total for this pair (sum of averages across groups)
      let total = 0;
      for (const g of allGroups) {
        const gVals = catMap[g] || [0];
        total += gVals.reduce((a, b) => a + b, 0) / gVals.length;
      }
      return total > 0 ? (avg / total) * 100 : 0;
    })
  }));

  lastChartTitle = 'SAWCD';
  renderStackedBarChart(canvas, {
    labels: pairLabels,
    datasets,
    xLabel: 'Time / Concentration',
    yLabel: 'SAWCD (%)',
    title: 'SAWCD — Carbon Source Group Distribution'
  });
}

/* ---------- CSV export ---------- */

function handleSaveCsv() {
  if (lastResults.length === 0) return;

  const isSawcd = lastTestType === 'sawcd';
  const label = typeLabel(lastTestType);

  const headers = ['Bacteria', 'Stressor', 'Concentration', 'Time', 'Blank', 'Repetition'];
  if (isSawcd) headers.push('Category');
  headers.push(label);

  const rows = [headers.map(csvEscape).join(',')];

  for (const r of lastResults) {
    const row = [
      csvEscape(r.bacteria),
      csvEscape(r.stressor),
      r.concentration,
      r.time,
      r.blank ? 'Yes' : 'No',
      r.repetition
    ];
    if (isSawcd) row.push(csvEscape(r.category));
    row.push(r.value.toFixed(4));
    rows.push(row.join(','));
  }

  downloadCsv(rows.join('\n'), `ecoplate-${lastTestType}.csv`);
}

/* ---------- Graph export ---------- */

function handleSaveGraph() {
  const canvas = document.getElementById('tests-chart-canvas');
  saveChartAsPNG(canvas, `ecoplate-${lastTestType || 'chart'}.png`);
}

/* ---------- Label helper ---------- */

function typeLabel(type) {
  switch (type) {
    case 'awcd': return 'AWCD';
    case 'sawcd': return 'SAWCD';
    case 'shannon': return 'Shannon Index';
    case 'evenness': return 'Shannon Evenness';
    default: return type;
  }
}
