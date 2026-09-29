import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let results = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== "node_modules" && file !== ".next") results.push(...walk(full));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css")) {
      results.push(full);
    }
  }
  return results;
}

const files = walk("app");

let findings = {
  microType: [],
  uppercaseTracking: [],
  tealEmerald: [],
  darkSurfaces: [],
  cardKit: [],
};

for (const f of files) {
  const relPath = f.replace(/\\/g, "/");
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  const isCanvasFile = relPath.includes("subsurface-scene.tsx") || relPath.includes("planning-3d-guidance.tsx");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Micro-type: text under 12px
    if (/text-\[(?:[0-9]|1[01])px\]/.test(line)) {
      findings.microType.push({ file: relPath, line: lineNum, text: line.trim() });
    }

    // Template chrome: ALL-CAPS letter-spaced labels
    if (/uppercase\s+tracking-/.test(line)) {
      findings.uppercaseTracking.push({ file: relPath, line: lineNum, text: line.trim() });
    }

    // Teal / emerald and brand tints (exempt data-scene-color)
    if (!line.includes("data-scene-color")) {
      if (/(?:teal-|emerald-|#38695a|#507567|#e8f0ed|#2d5749|#1e3b32)/i.test(line)) {
        findings.tealEmerald.push({ file: relPath, line: lineNum, text: line.trim() });
      }
    }

    // Dark surfaces (exempt the 3D canvas container in subsurface-scene / planning-3d-guidance)
    if (/(?:bg-slate-900|bg-slate-950|bg-zinc-900|bg-[#101e25]|bg-[#0d1a20])/.test(line)) {
      const isCanvasWrapper = isCanvasFile && (line.includes("<canvas") || line.includes("bg-[#101e25]") || line.includes("bg-[#0d1a20]"));
      if (!isCanvasWrapper) {
        findings.darkSurfaces.push({ file: relPath, line: lineNum, text: line.trim() });
      }
    }

    // Card kit: rounded-xl/2xl/3xl or blur
    if (/rounded-(?:xl|2xl|3xl)/.test(line) || /rounded-\[(?:1[3-9]|[2-9]\d)px\]/.test(line) || /(?:backdrop-blur|blur-)/.test(line)) {
      findings.cardKit.push({ file: relPath, line: lineNum, text: line.trim() });
    }
  }
}

const totalFindings =
  findings.microType.length +
  findings.uppercaseTracking.length +
  findings.tealEmerald.length +
  findings.darkSurfaces.length +
  findings.cardKit.length;

console.log("=== Design Check Summary ===");
console.log(`1. Micro-type (<12px): ${findings.microType.length} lines`);
console.log(`2. Uppercase letter-spaced labels: ${findings.uppercaseTracking.length} lines`);
console.log(`3. Teal / emerald / dark tints: ${findings.tealEmerald.length} lines`);
console.log(`4. Dark surfaces: ${findings.darkSurfaces.length} lines`);
console.log(`5. Card kit (rounded-xl+, blur, glow): ${findings.cardKit.length} lines`);
console.log(`Total findings: ${totalFindings}`);

const isReportOnly = process.argv.includes("--report-only") || process.env.REPORT_ONLY === "1";

if (totalFindings > 0) {
  if (isReportOnly) {
    console.log("\n[REPORT-ONLY] Baseline defects recorded.");
    process.exit(0);
  } else {
    console.error(`\nFAIL: Design check found ${totalFindings} defects.`);
    process.exit(1);
  }
} else {
  console.log("\nPASS: Zero design defects found.");
  process.exit(0);
}
