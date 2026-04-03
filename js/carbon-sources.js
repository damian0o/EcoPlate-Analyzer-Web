export const CARBON_SOURCE_MATRIX = [
  ["Water", "Betha-Methyl-D-Glucoside", "D-Galactonic Acid gamma-Lactone", "L-Arginine"],
  ["Pyruvic Acid Methyl Ester", "D-Xylose", "D-Galacturonic Acid", "L-Asparagine"],
  ["Tween 40", "i-Erythritol", "2-HydroxyBenzoic Acid", "L-Phenylalanine"],
  ["Tween 80", "D-Mannitol", "4-HydroxyBenzoic Acid", "L-Serine"],
  ["Alpha-Cyclodextrin", "N-Acetyl-D-Glucosamine", "Gamma-Amino Butyric Acid", "L-Threonine"],
  ["Glycogen", "D-Glucosaminic Acid", "Itaconic Acid", "Betha-HydroxyGlycyl-L-Glutamic Acid"],
  ["D-Cellobiose", "Glucose-1-Phosphate", "Alpha-KetoButyric Acid", "Phenylethylamine"],
  ["Alpha-D-Lactose", "D,L-alpha-Glycerol Phosphate", "D-Malic Acid", "Putrescine"]
];

export const CARBON_SOURCE_GROUPS = {
  "polymers": ["Tween 40", "Tween 80", "Alpha-Cyclodextrin", "Glycogen"],
  "carbohydrates": ["D-Cellobiose", "Alpha-D-Lactose", "Betha-Methyl-D-Glucoside",
    "D-Xylose", "i-Erythritol", "D-Mannitol", "N-Acetyl-D-Glucosamine",
    "Glucose-1-Phosphate", "D,L-alpha-Glycerol Phosphate", "D-Galactonic Acid gamma-Lactone"],
  "carboxylic acids": ["D-Galacturonic Acid", "Pyruvic Acid Methyl Ester", "D-Glucosaminic Acid",
    "Gamma-Amino Butyric Acid", "Itaconic Acid", "Alpha-KetoButyric Acid", "D-Malic Acid"],
  "aminoacids": ["L-Asparagine", "L-Arginine", "L-Phenylalanine", "L-Serine", "L-Threonine",
    "Betha-HydroxyGlycyl-L-Glutamic Acid"],
  "amines": ["Phenylethylamine", "Putrescine"],
  "phenolic compounds": ["2-HydroxyBenzoic Acid", "4-HydroxyBenzoic Acid"]
};
