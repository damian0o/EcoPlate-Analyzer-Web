const DATA_BASE_URL = 'https://damian0o.github.io/EcoPlate-Data';

export async function fetchIndex() {
  const res = await fetch(`${DATA_BASE_URL}/index.json`);
  if (!res.ok) throw new Error('Failed to fetch data index');
  return res.json();
}

export async function fetchExperiment(jsonFilename) {
  const res = await fetch(`${DATA_BASE_URL}/${jsonFilename}`);
  if (!res.ok) throw new Error(`Failed to fetch ${jsonFilename}`);
  return res.json();
}
