import { EcoplateRecord } from './record.js';

const state = {
  records: [],
  recordsIndex: {
    bacteria: {},
    stressor: {},
    concentration: {},
    time: {},
    blank: {},
    repetition: {},
    filename: {}
  }
};

export function addRecord(record) {
  state.records.push(record);
  for (const key of Object.keys(state.recordsIndex)) {
    const value = key === 'filename' ? record.fileName : record[key];
    if (!state.recordsIndex[key][value]) state.recordsIndex[key][value] = [];
    state.recordsIndex[key][value].push(record);
  }
}

export function removeRecord(record) {
  state.records = state.records.filter(r => r !== record);
  for (const key of Object.keys(state.recordsIndex)) {
    const value = key === 'filename' ? record.fileName : record[key];
    if (state.recordsIndex[key][value]) {
      state.recordsIndex[key][value] = state.recordsIndex[key][value].filter(r => r !== record);
      if (state.recordsIndex[key][value].length === 0) delete state.recordsIndex[key][value];
    }
  }
}

export function getRecords() { return state.records; }
export function getIndex() { return state.recordsIndex; }
export function getUniqueValues(field) {
  return [...new Set(state.records.map(r => field === 'filename' ? r.fileName : r[field]))];
}
