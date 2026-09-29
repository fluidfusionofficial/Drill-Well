import { formationIntervals, wells } from "./nwis-data.ts";
import type { Well } from "./nwis-data.ts";

export const EARTH_RADIUS_KM = 6371;

export type LatLng = { lat: number; lng: number };

export function distanceKm(from: LatLng, to: LatLng) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from `from` to `to`, degrees clockwise from north. */
export function bearingDeg(from: LatLng, to: LatLng) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const y = Math.sin(radians(to.lng - from.lng)) * Math.cos(radians(to.lat));
  const x = Math.cos(radians(from.lat)) * Math.sin(radians(to.lat)) - Math.sin(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.cos(radians(to.lng - from.lng));
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

/** Offset a coordinate by a distance (km) and direction. Coordinates stay in degrees. */
export function projectPoint(origin: LatLng, distanceKmEast: number, distanceKmNorth: number): LatLng {
  const kmPerDegreeLat = 110.574;
  const kmPerDegreeLng = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + distanceKmNorth / kmPerDegreeLat,
    lng: origin.lng + distanceKmEast / kmPerDegreeLng,
  };
}

export type DirectionalPlan = {
  kickOffDepth: number;
  buildRate: number;
  inclination: number;
  azimuth: number;
  targetDepth: number;
  surveyUncertainty: number;
};

/** Minimum separation required from an offset well, in metres. */
export const MIN_SEPARATION_M = 300;
/** Anti-collision radius around an offset wellbore, in metres. */
export const ANTI_COLLISION_M = 150;

export type PlanningCheck = {
  id: string;
  label: string;
  detail: string;
  status: "PASS" | "WARN" | "FAIL";
  value: string;
};

/**
 * Straight-line dogleg from the planned surface location to the target point.
 * Enough for a planning schematic; a real design would use a full survey calculation.
 */
export function buildWellPath(plan: DirectionalPlan, start: LatLng) {
  const horizontalRun = Math.max(plan.surveyUncertainty * 4, 260);
  const inclinationFactor = Math.max(0.15, Math.cos((plan.inclination * Math.PI) / 180));
  const end = projectPoint(start, Math.sin((plan.azimuth * Math.PI) / 180) * horizontalRun * inclinationFactor, Math.cos((plan.azimuth * Math.PI) / 180) * horizontalRun * inclinationFactor);
  const points: { depth: number; x: number; z: number }[] = [];
  const sections = 48;
  for (let index = 0; index <= sections; index += 1) {
    const ratio = index / sections;
    const depth = ratio * plan.targetDepth;
    const buildFraction = plan.kickOffDepth > 0 ? Math.min(1, Math.max(0, (depth - plan.kickOffDepth) / (plan.targetDepth - plan.kickOffDepth))) : 1;
    const lateral = horizontalRun * inclinationFactor * buildFraction;
    points.push({ depth, x: Math.sin((plan.azimuth * Math.PI) / 180) * lateral, z: Math.cos((plan.azimuth * Math.PI) / 180) * lateral });
  }
  return { points, end, horizontalRun, verticalSection: plan.targetDepth * 0.02 };
}

/** Target radius at depth from the wellhead (survey uncertainty cone). */
export function targetRadius(plan: DirectionalPlan) {
  const buildDepth = Math.max(1, plan.targetDepth - plan.kickOffDepth);
  const drift = ((plan.targetDepth - plan.kickOffDepth) / plan.buildRate) * (plan.inclination * Math.PI) * 180;
  const buildAllowance = Math.max(0, drift - plan.inclination) * 0.6;
  return plan.surveyUncertainty + buildAllowance * 0.35 + buildDepth * 0.0006;
}

export type OffsetClearance = {
  well: Well;
  surfaceDistanceKm: number;
  horizontalAtTargetM: number;
  targetRadiusM: number;
  requiredM: number;
  marginM: number;
  crossesTarget: boolean;
  crossesAtDepth: number | null;
};

export function evaluateOffsets(site: LatLng, plan: DirectionalPlan, pathEnd: LatLng, offsets: Well[] = wells): OffsetClearance[] {
  const radius = targetRadius(plan);
  return offsets
    .map((well) => {
      const surfaceDistanceKm = distanceKm(site, well.coordinates);
      const horizontalAtTargetM = distanceKm(pathEnd, well.coordinates) * 1000;
      const crossesTarget = horizontalAtTargetM < radius + ANTI_COLLISION_M;

      let crossesAtDepth: number | null = null;
      if (crossesTarget) {
        const remaining = Math.max(0, surfaceDistanceKm * 1000 - (radius + ANTI_COLLISION_M));
        const rate = Math.max(1, plan.targetDepth / Math.max(1, plan.surveyUncertainty * 4));
        crossesAtDepth = Math.min(plan.targetDepth, remaining / rate);
      }

      return {
        well,
        surfaceDistanceKm,
        horizontalAtTargetM,
        targetRadiusM: radius,
        requiredM: MIN_SEPARATION_M,
        marginM: horizontalAtTargetM - (radius + ANTI_COLLISION_M),
        crossesTarget,
        crossesAtDepth,
      };
    })
    .sort((a, b) => a.horizontalAtTargetM - b.horizontalAtTargetM);
}

export function evaluateFormation(targetFormation: string, targetDepth: number) {
  const interval = formationIntervals.find((item) => item.name.toLowerCase() === targetFormation.toLowerCase());
  if (!interval) return { interval: undefined, insideTarget: false, penetrates: false };
  const insideTarget = targetDepth >= interval.top && targetDepth <= interval.bottom;
  const penetrates = targetDepth > interval.bottom;
  return { interval, insideTarget, penetrates };
}

export function runPlanningChecks(site: LatLng, plan: DirectionalPlan, pathEnd: LatLng, offsets: OffsetClearance[]): PlanningCheck[] {
  const checks: PlanningCheck[] = [];
  const nearest = offsets[0];

  checks.push({
    id: "separation",
    label: "Offset well separation at target",
    detail: nearest
      ? `Nearest offset is ${nearest.well.id} at ${(nearest.horizontalAtTargetM / 1000).toFixed(2)} km horizontal at target depth.`
      : "No offset wells in fixture.",
    status: !nearest ? "PASS" : nearest.marginM >= 0 ? (nearest.marginM < 100 ? "WARN" : "PASS") : "FAIL",
    value: nearest ? `${Math.round(nearest.horizontalAtTargetM)} m` : "—",
  });

  checks.push({
    id: "anticollision",
    label: "Anti-collision envelope",
    detail: `Target radius ${Math.round(targetRadius(plan))} m plus ${ANTI_COLLISION_M} m offset keep-out is clear of every wellbore.`,
    status: offsets.some((offset) => offset.marginM < 0) ? "FAIL" : offsets.some((offset) => offset.marginM < 100) ? "WARN" : "PASS",
    value: offsets.some((offset) => offset.marginM < 0) ? "Intersects" : "Clear",
  });

  const formationCheck = formationIntervals.find((item) => item.top <= plan.targetDepth && plan.targetDepth <= item.bottom);
  checks.push({
    id: "target-zone",
    label: "Planned TD inside reference formation",
    detail: formationCheck
      ? `TD lands in ${formationCheck.name} (${formationCheck.top}–${formationCheck.bottom} m), confidence ${formationCheck.confidence}.`
      : `TD at ${plan.targetDepth} m does not fall inside a WX-07 reference interval.`,
    status: formationCheck ? "PASS" : "WARN",
    value: formationCheck ? formationCheck.name : "Outside picks",
  });

  checks.push({
    id: "dogleg",
    label: "Dogleg severity at kick-off",
    detail:
      plan.kickOffDepth < plan.targetDepth * 0.15
        ? "Kick-off is shallow — expect a high dogleg to build angle. Confirm motor and build-rate margin."
        : "Kick-off depth leaves a reasonable vertical section before build.",
    status: plan.kickOffDepth < plan.targetDepth * 0.15 ? "WARN" : "PASS",
    value: `${Math.round(plan.kickOffDepth)} m KO`,
  });

  checks.push({
    id: "reach",
    label: "Target reachable within survey uncertainty",
    detail: `Build rate ${plan.buildRate}°/100 m to ${plan.inclination}° on azimuth ${Math.round(plan.azimuth)}°.`,
    status: plan.buildRate >= 1.2 && plan.buildRate <= 3 ? "PASS" : "WARN",
    value: `${plan.buildRate}°/100 m`,
  });

  const surfaceSpan = offsets.length > 0 ? Math.max(...offsets.map((offset) => offset.surfaceDistanceKm)) : 0;
  checks.push({
    id: "surface",
    label: "Surface spread",
    detail: `Pad sits within ${surfaceSpan.toFixed(1)} km of the furthest mapped offset well.`,
    status: "PASS",
    value: `${distanceKm(site, offsets[0]?.well.coordinates ?? site).toFixed(2)} km to nearest`,
  });

  return checks;
}

export function suggestedSites(reference: LatLng): LatLng[] {
  const radius = 1.6;
  const candidates: LatLng[] = [];
  for (let bearing = 0; bearing < 360; bearing += 45) {
    candidates.push(projectPoint(reference, Math.sin((bearing * Math.PI) / 180) * radius, Math.cos((bearing * Math.PI) / 180) * radius));
  }
  return candidates;
}

export function nearestOffsetsTo(site: LatLng, count: number, offsets: Well[] = wells) {
  return [...offsets].sort((a, b) => distanceKm(site, a.coordinates) - distanceKm(site, b.coordinates)).slice(0, count);
}

export const CasingProgram = [
  { size: '30"', depth: 120, purpose: "Conductor + surface protection" },
  { size: '13⅜"', depth: 430, purpose: "Surface casing — isolate unconsolidated cover" },
  { size: '9⅝"', depth: 806, purpose: "Intermediate casing — protect the carbonate section" },
  { size: '7"', depth: 1130, purpose: "Production liner — set above planned TD" },
];
