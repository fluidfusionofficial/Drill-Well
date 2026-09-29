/**
 * Event taxonomy and categorization engine.
 * Categorizes operational events into 6 standardized drilling hazard types.
 */

export type HazardCategory =
  | "Mud loss"
  | "Held-up / stuck pipe"
  | "Kick / influx"
  | "Torque and tight hole"
  | "Cementing / casing"
  | "Other NPT";

export const HAZARD_CATEGORIES: readonly HazardCategory[] = [
  "Mud loss",
  "Held-up / stuck pipe",
  "Kick / influx",
  "Torque and tight hole",
  "Cementing / casing",
  "Other NPT",
] as const;

export type GlyphShape =
  | "inverted-triangle"
  | "square"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "circle";

export interface HazardMeta {
  category: HazardCategory;
  color: string;
  shape: GlyphShape;
  label: string;
}

export const HAZARD_CONFIG: Record<HazardCategory, HazardMeta> = {
  "Mud loss": {
    category: "Mud loss",
    color: "#0072B2",
    shape: "inverted-triangle",
    label: "Mud loss",
  },
  "Held-up / stuck pipe": {
    category: "Held-up / stuck pipe",
    color: "#D55E00",
    shape: "square",
    label: "Held-up / stuck pipe",
  },
  "Kick / influx": {
    category: "Kick / influx",
    color: "#B3261E",
    shape: "diamond",
    label: "Kick / influx",
  },
  "Torque and tight hole": {
    category: "Torque and tight hole",
    color: "#7B4FBF",
    shape: "triangle",
    label: "Torque and tight hole",
  },
  "Cementing / casing": {
    category: "Cementing / casing",
    color: "#9A6B00",
    shape: "hexagon",
    label: "Cementing / casing",
  },
  "Other NPT": {
    category: "Other NPT",
    color: "#667085",
    shape: "circle",
    label: "Other NPT",
  },
};

/**
 * Maps arbitrary event type strings into one of the 6 canonical categories.
 * Falls back deterministically to "Other NPT".
 */
export function classifyEvent(type?: string | null): HazardCategory {
  if (!type) return "Other NPT";
  const lower = type.toLowerCase().trim();

  if (
    lower.includes("mud loss") ||
    lower.includes("loss of circ") ||
    lower.includes("seepage") ||
    lower.includes("lost circulation")
  ) {
    return "Mud loss";
  }

  if (
    lower.includes("held up") ||
    lower.includes("stuck") ||
    lower.includes("pipe stick") ||
    lower.includes("pack off") ||
    lower.includes("tight pull")
  ) {
    return "Held-up / stuck pipe";
  }

  if (
    lower.includes("kick") ||
    lower.includes("influx") ||
    lower.includes("well control") ||
    lower.includes("flow check") ||
    lower.includes("gas show")
  ) {
    return "Kick / influx";
  }

  if (
    lower.includes("torque") ||
    lower.includes("tight hole") ||
    lower.includes("drag") ||
    lower.includes("reaming") ||
    lower.includes("high torque")
  ) {
    return "Torque and tight hole";
  }

  if (
    lower.includes("cement") ||
    lower.includes("casing") ||
    lower.includes("shoe") ||
    lower.includes("liner")
  ) {
    return "Cementing / casing";
  }

  return "Other NPT";
}
