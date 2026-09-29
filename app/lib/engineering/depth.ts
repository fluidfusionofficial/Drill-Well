/**
 * Depth reference types. MD and TVD are never silently interchanged.
 * MD  — measured depth along the borehole
 * TVD — true vertical depth below surface/sea level reference
 * KB  — kelly bushing / rotary table depth
 * DFE — drill floor elevation
 */
export type DepthReferenceType = "MD" | "TVD" | "KB" | "DFE" | "unknown";

export type Depth = {
  value: number;
  reference: DepthReferenceType;
  unit: "m";
};

export function depth(value: number, reference: DepthReferenceType = "MD"): Depth {
  return { value, reference, unit: "m" };
}

export function isSameDepthReference(a: DepthReferenceType, b: DepthReferenceType) {
  return a === b || a === "unknown" || b === "unknown";
}

/**
 * Convert between depth references.
 * Without a surveyed trajectory, MD->TVD cannot be derived, so the conversion
 * is refused rather than approximated. Callers must supply a real TVD survey.
 */
export function convertDepth(source: Depth, target: DepthReferenceType, tvdAtDepth?: (md: number) => number): Depth | null {
  if (source.reference === target) return { ...source, reference: target };
  if (source.reference === "MD" && target === "TVD") {
    if (!tvdAtDepth) return null;
    return depth(tvdAtDepth(source.value), "TVD");
  }
  if (source.reference === "TVD" && target === "MD") return null;
  return null;
}

export function depthWindowLabel(window: { top: number; bottom: number; reference: DepthReferenceType }) {
  return `${window.top}–${window.bottom} m ${window.reference}`;
}

export function withinDepth(value: number, top: number, bottom: number) {
  return value >= top && value <= bottom;
}
