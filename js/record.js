export class EcoplateRecord {
  constructor({ bacteria, stressor, concentration, time, blank, repetition, ecoplate, fileName }) {
    this.bacteria = bacteria;
    this.stressor = stressor;
    this.concentration = Number(concentration);
    this.time = Number(time);
    this.blank = Boolean(blank);
    this.repetition = Number(repetition);
    this.ecoplate = ecoplate; // 8x4 matrix of numbers
    this.fileName = fileName;
  }
}
