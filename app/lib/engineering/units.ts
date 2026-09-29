/**
 * Unit-aware engineering values.
 * Every reading keeps the value exactly as it appeared in the source plus the
 * unit that was written, alongside a normalized SI value. Nothing is silently
 * overwritten: 1.48 g/cm3 is never displayed as 1.48 ppg.
 */

export type Unit = "g/cm3" | "ppg" | "m" | "ft" | "mm" | "in" | "psi" | "bar" | "kPa" | "cP" | "s" | "lbf/100ft2" | "Pa" | "mL" | "bbl" | "degC" | "rpm" | "m3/h" | "l/min" | "%";

/** Canonical unit for each dimension. */
export const canonicalUnit: Record<string, Unit> = {
  mud_weight: "g/cm3",
  length: "m",
  pressure: "psi",
  viscosity_cp: "cP",
  yield_point: "Pa",
  flow: "l/min",
  temperature: "degC",
};

export type NormalizedValue<T extends Unit = Unit> = {
  /** Value exactly as parsed from the source document. */
  originalValue: number;
  originalUnit: string;
  /** Value converted to the canonical unit for its dimension. */
  normalizedValue: number;
  normalizedUnit: T;
  /** True when the source unit differed from the canonical unit. */
  converted: boolean;
  parseConfidence: "HIGH" | "MEDIUM" | "LOW";
};

const PPG_PER_G_CM3 = 8.345404452;
const M_PER_FT = 0.3048;
const IN_PER_MM = 1 / 25.4;
const PSI_PER_KPA = 0.1450377377;
const PA_PER_LBF_100FT2 = 47.88025898;
const M3H_PER_LMIN = 0.06;

export const unitAliases: Record<string, Unit> = {
  "g/cm3": "g/cm3",
  "g/cm³": "g/cm3",
  "gm/cc": "g/cm3",
  "sg": "g/cm3",
  ppg: "ppg",
  "lb/gal": "ppg",
  m: "m",
  metre: "m",
  meters: "m",
  meter: "m",
  "m.": "m",
  ft: "ft",
  feet: "ft",
  mm: "mm",
  in: "in",
  inch: "in",
  '"': "in",
  psi: "psi",
  bar: "bar",
  kpa: "kPa",
  cp: "cP",
  cP: "cP",
  s: "s",
  sec: "s",
  seconds: "s",
  "lbf/100ft2": "lbf/100ft2",
  mL: "mL",
  ml: "mL",
  cc: "mL",
  bbl: "bbl",
  bbls: "bbl",
  "°c": "degC",
  c: "degC",
  rpm: "rpm",
  "m3/h": "m3/h",
  "l/min": "l/min",
  lpm: "l/min",
  "%": "%",
};

/** Split "1.48 g/cm³" into numeric and unit parts. */
export function parseWithUnit(raw: string): { value: number; unit: string } | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(raw);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return { value, unit: (match[2] ?? "").trim() };
}

export function resolveUnit(rawUnit: string): Unit | null {
  const key = rawUnit.trim().toLowerCase();
  return unitAliases[key] ?? null;
}

/**
 * Normalize a measurement to the canonical unit for its dimension.
 * Returns null when the unit is not recognised — callers must then surface
 * "unit unrecognised" rather than guessing.
 */
export function normalize(value: number, rawUnit: string, dimension: string): NormalizedValue | null {
  const unit = resolveUnit(rawUnit);
  if (!unit) return null;
  const target = canonicalUnit[dimension];
  if (!target) return null;

  let normalizedValue = value;
  let converted = false;

  switch (dimension) {
    case "mud_weight":
      if (unit === "ppg") {
        normalizedValue = value / PPG_PER_G_CM3;
        converted = true;
      }
      break;
    case "length":
      if (unit === "ft") {
        normalizedValue = value * M_PER_FT;
        converted = true;
      } else if (unit === "mm") {
        normalizedValue = value / 1000;
        converted = true;
      } else if (unit === "in") {
        normalizedValue = value / IN_PER_MM / 1000;
        converted = true;
      }
      break;
    case "pressure":
      if (unit === "bar") {
        normalizedValue = value * 100;
        converted = true;
      } else if (unit === "kPa") {
        normalizedValue = value * PSI_PER_KPA;
        converted = true;
      }
      break;
    case "yield_point":
      if (unit === "lbf/100ft2") {
        normalizedValue = value * PA_PER_LBF_100FT2;
        converted = true;
      }
      break;
    case "flow":
      if (unit === "m3/h") {
        normalizedValue = value / M3H_PER_LMIN;
        converted = true;
      }
      break;
    default:
      break;
  }

  return {
    originalValue: value,
    originalUnit: rawUnit,
    normalizedValue: round(normalizedValue, 4),
    normalizedUnit: target,
    converted,
    parseConfidence: "HIGH",
  };
}

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Human readable with the source unit preserved, e.g. "1.48 g/cm³ (1.48 g/cm³)". */
export function formatWithSource(measurement: NormalizedValue, places = 2) {
  const source = `${round(measurement.originalValue, places)} ${measurement.originalUnit}`;
  if (!measurement.converted) return source;
  return `${source} (${round(measurement.normalizedValue, places)} ${measurement.normalizedUnit})`;
}
