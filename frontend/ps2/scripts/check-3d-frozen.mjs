import fs from "node:fs";
import crypto from "node:crypto";

let errors = [];

// 1. Check subsurface-scene.tsx
try {
  const subContent = fs.readFileSync("app/components/subsurface-scene.tsx", "utf8");
  const subLines = subContent.split(/\r?\n/);
  const subReturnIdx = subLines.findLastIndex((l) => l.startsWith("  return ("));
  if (subReturnIdx === -1) {
    errors.push("app/components/subsurface-scene.tsx: Could not find return statement");
  } else {
    const frozenLines = subLines.slice(0, subReturnIdx).filter((l) => {
      if (l.includes("lucide-react")) return false;
      if (l.includes("panelOpen")) return false;
      return true;
    });
    const subHash = crypto.createHash("sha256").update(frozenLines.join("\n")).digest("hex");
    const EXPECTED_SUB_HASH = "47017f43c60617117108dc0bb1954e7459ce2c0def5e1b82dfa4a5a10cc229c8";
    if (subHash !== EXPECTED_SUB_HASH) {
      errors.push(`app/components/subsurface-scene.tsx: Frozen region modified! Hash: ${subHash}, Expected: ${EXPECTED_SUB_HASH}`);
    }
  }
} catch (err) {
  errors.push(`app/components/subsurface-scene.tsx: ${err.message}`);
}

// 2. Check planning-3d-guidance.tsx
try {
  const planContent = fs.readFileSync("app/components/planning-3d-guidance.tsx", "utf8");
  const planLines = planContent.split(/\r?\n/);
  const planReturnIdx = planLines.findLastIndex((l) => l.startsWith("  return ("));
  if (planReturnIdx === -1) {
    errors.push("app/components/planning-3d-guidance.tsx: Could not find return statement");
  } else {
    const frozenLines = planLines.slice(0, planReturnIdx).filter((l) => {
      if (l.includes("lucide-react")) return false;
      return true;
    });
    const planHash = crypto.createHash("sha256").update(frozenLines.join("\n")).digest("hex");
    const EXPECTED_PLAN_HASH = "abf587e86ea35dbc919ff965e0b1dcf298b5fea3680083f22e917b217a1d23dc";
    if (planHash !== EXPECTED_PLAN_HASH) {
      errors.push(`app/components/planning-3d-guidance.tsx: Frozen region modified! Hash: ${planHash}, Expected: ${EXPECTED_PLAN_HASH}`);
    }
  }
} catch (err) {
  errors.push(`app/components/planning-3d-guidance.tsx: ${err.message}`);
}

// 3. Check lib/nwis-data.ts frozen exports
try {
  const nwisContent = fs.readFileSync("app/lib/nwis-data.ts", "utf8");
  if (!nwisContent.includes("export const formationIntervals")) errors.push("nwis-data.ts: formationIntervals export missing");
  if (!nwisContent.includes("export const wellEvents")) errors.push("nwis-data.ts: wellEvents export missing");
  if (!nwisContent.includes("export function formationAtReferenceDepth")) errors.push("nwis-data.ts: formationAtReferenceDepth export missing");
  if (!nwisContent.includes("export const wells")) errors.push("nwis-data.ts: wells export missing");
  if (!nwisContent.includes("export const currentWell = wells[1]")) errors.push("nwis-data.ts: currentWell = wells[1] missing or reordered");
} catch (err) {
  errors.push(`app/lib/nwis-data.ts: ${err.message}`);
}

if (errors.length > 0) {
  console.error("FAIL: 3D frozen check failed:");
  for (const err of errors) console.error("  - " + err);
  process.exit(1);
} else {
  console.log("PASS: 3D frozen regions and data exports are intact.");
  process.exit(0);
}
