// Set2-like color palette
const SET2_COLORS = [
  'rgb(102, 194, 165)', 'rgb(252, 141, 98)', 'rgb(141, 160, 203)',
  'rgb(231, 138, 195)', 'rgb(166, 216, 84)', 'rgb(255, 217, 47)',
  'rgb(229, 196, 148)', 'rgb(179, 179, 179)'
];

let currentChart = null;

export function renderGroupedBarChart(canvasElement, { labels, datasets, xLabel, yLabel, title }) {
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(canvasElement, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((ds, i) => ({
        ...ds,
        backgroundColor: SET2_COLORS[i % SET2_COLORS.length],
      }))
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: title }, legend: { position: 'right' } },
      scales: {
        x: { title: { display: true, text: xLabel } },
        y: { title: { display: true, text: yLabel } }
      }
    }
  });
}

export function renderStackedBarChart(canvasElement, { labels, datasets, xLabel, yLabel, title }) {
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(canvasElement, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((ds, i) => ({
        ...ds,
        backgroundColor: SET2_COLORS[i % SET2_COLORS.length],
      }))
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: title }, legend: { position: 'right' } },
      scales: {
        x: { stacked: true, title: { display: true, text: xLabel } },
        y: { stacked: true, max: 100, title: { display: true, text: yLabel } }
      }
    }
  });
}

export function saveChartAsPNG(canvasElement, filename) {
  const link = document.createElement('a');
  link.download = filename || 'chart.png';
  link.href = canvasElement.toDataURL('image/png');
  link.click();
}
