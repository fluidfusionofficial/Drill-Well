"use client";

/**
 * Geological lithology rendering.
 *
 * These are real industry lithological conventions rather than decorative fills:
 * cross-bedded sets in sandstone, stylolite seams and fossil traces in limestone,
 * cryptobrecciated vugs in dolomite, fine parallel laminae in shale, sorted
 * clast outlines in conglomerate, salt mottling in evaporite and a crystalline
 * fabric in basement.
 */

export type Lithology = "limestone" | "dolomite" | "sandstone" | "shale" | "siltstone" | "conglomerate" | "evaporite" | "basement" | "alluvium" | "coal" | "unknown";

type Symbol = {
  fill: string;
  deep: string;
  line: string;
  label: string;
  short: string;
};

export const lithologySymbols: Record< Lithology, Symbol> = {
  limestone: { fill: "#9fb0b4", deep: "#6e858c", line: "#4a6068", label: "Limestone", short: "LS" },
  dolomite: { fill: "#b3a893", deep: "#8a7d66", line: "#5f5647", label: "Dolomite", short: "DL" },
  sandstone: { fill: "#dcbb7f", deep: "#b08f52", line: "#7d6231", label: "Sandstone", short: "SS" },
  shale: { fill: "#7d8a86", deep: "#55625f", line: "#39433f", label: "Shale", short: "SH" },
  siltstone: { fill: "#c2b493", deep: "#95866a", line: "#665c47", label: "Siltstone", short: "SLT" },
  conglomerate: { fill: "#c9a377", deep: "#9c7b53", line: "#6b5233", label: "Conglomerate", short: "CGL" },
  evaporite: { fill: "#b4a6c4", deep: "#87789b", line: "#5d5270", label: "Evaporite", short: "EV" },
  basement: { fill: "#8a8f98", deep: "#5b6069", line: "#3a3e45", label: "Basement", short: "BMT" },
  alluvium: { fill: "#cdb188", deep: "#a2885e", line: "#6f5b3a", label: "Alluvium", short: "ALV" },
  coal: { fill: "#4a4a4a", deep: "#2c2c2c", line: "#1a1a1a", label: "Coal", short: "C" },
  unknown: { fill: "#b4bcc0", deep: "#8d979c", line: "#616b70", label: "Not logged", short: "—" },
};

export function inferLithology(lithology: string, formationName: string): Lithology {
  const text = `${formationName} ${lithology}`.toLowerCase();
  if (text.includes("basement") || text.includes("crystalline")) return "basement";
  if (text.includes("evaporit") || text.includes("salt") || text.includes("anhydrite")) return "evaporite";
  if (text.includes("alluvium") || text.includes("alluvial") || text.includes("shale-silt")) return "alluvium";
  if (text.includes("conglomerate")) return "conglomerate";
  if (text.includes("shale") || text.includes("claystone")) return "shale";
  if (text.includes("siltstone")) return "siltstone";
  if (text.includes("dolomit")) return "dolomite";
  if (text.includes("limestone") || text.includes("carbonate")) return "limestone";
  if (text.includes("sandstone") || text.includes("sand ")) return "sandstone";
  return "unknown";
}

/**
 * Deterministic pseudo-random so a unit always renders identically.
 */
function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function seedFrom(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Builds the <defs> for every lithology pattern. Patterns are generated with
 * real geometry: inclined cross-bed sets, stylolite seams, clast outlines.
 */
export function GeologicalPatterns({ prefix = "geo" }: { prefix?: string }) {
  const id = (name: string) => `${prefix}-${name}`;

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {/* Sandstone — inclined cross-bedded sets with foreset truncation */}
        <pattern id={id("sandstone")} width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill={lithologySymbols.sandstone.fill} />
          <g stroke={lithologySymbols.sandstone.line} strokeWidth="0.7" opacity="0.65">
            <path d="M-4 14 L20 2" />
            <path d="M-4 18 L24 4" />
            <path d="M-4 22 L28 6" />
            <path d="M2 46 L48 18" />
            <path d="M6 48 L48 22" />
            <path d="M10 48 L48 26" />
            <path d="M14 48 L48 30" />
          </g>
          <g stroke="#f4e3c0" strokeWidth="0.5" opacity="0.45">
            <path d="M-4 15.5 L21 2.8" />
            <path d="M8 47 L48 20" />
          </g>
          <path d="M-4 25 L48 12" stroke={lithologySymbols.sandstone.line} strokeWidth="1.4" opacity="0.8" fill="none" />
        </pattern>

        {/* Limestone — bedding planes + stylolite seams + fossil traces */}
        <pattern id={id("limestone")} width="52" height="52" patternUnits="userSpaceOnUse">
          <rect width="52" height="52" fill={lithologySymbols.limestone.fill} />
          <g stroke={lithologySymbols.limestone.line} strokeWidth="0.55" opacity="0.5">
            <path d="M0 8 H52" />
            <path d="M0 26 H52" />
            <path d="M0 41 H52" />
          </g>
          <g fill="none" stroke={lithologySymbols.limestone.line} strokeWidth="1.1" opacity="0.75">
            <path d="M11 2 q2.4 6 -1 12 q-2.6 5 1 11 q2.2 5 -0.8 10" />
            <path d="M33 6 q-2.6 6 1 11 q2.4 5 -0.8 10 q-2 5 1 9" />
          </g>
          <g fill="none" stroke="#e9f2f2" strokeWidth="0.7" opacity="0.6">
            <path d="M20 20 q5 -3 9 0 q-4 3 -9 0 Z" />
            <path d="M24 21.5 l6 3 M27 20.5 l-4 3" />
            <path d="M38 34 q4 -2.4 7 0 q-3 2.4 -7 0 Z" />
          </g>
        </pattern>

        {/* Dolomite — cryptobrecciated, vuggy, finer mottling */}
        <pattern id={id("dolomite")} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={lithologySymbols.dolomite.fill} />
          <g fill={lithologySymbols.dolomite.deep} opacity="0.55">
            <ellipse cx="8" cy="9" rx="4.5" ry="2.6" transform="rotate(-14 8 9)" />
            <ellipse cx="24" cy="18" rx="3.4" ry="4.2" transform="rotate(22 24 18)" />
            <ellipse cx="14" cy="30" rx="5" ry="2.2" transform="rotate(8 14 30)" />
            <ellipse cx="32" cy="34" rx="3" ry="3.4" />
          </g>
          <g stroke={lithologySymbols.dolomite.line} strokeWidth="0.5" opacity="0.5" fill="none">
            <path d="M0 13 L40 13" />
            <path d="M0 27 L40 27" />
            <path d="M17 0 L17 40" strokeDasharray="2 3" />
          </g>
          <g fill="none" stroke="#f0ece1" strokeWidth="0.6" opacity="0.65">
            <path d="M28 6 l5 3 l-4 4" />
            <path d="M4 24 l6 2 l-3 4" />
          </g>
        </pattern>

        {/* Shale — very fine parallel laminae, fissile */}
        <pattern id={id("shale")} width="44" height="30" patternUnits="userSpaceOnUse">
          <rect width="44" height="30" fill={lithologySymbols.shale.fill} />
          <g stroke={lithologySymbols.shale.line} strokeWidth="0.5" opacity="0.6">
            {Array.from({ length: 9 }, (_, index) => (
              <line key={index} x1="0" y1={index * 3.2} x2="44" y2={index * 3.2 + (index % 2 ? 0.6 : -0.4)} />
            ))}
          </g>
          <g stroke="#a9b4b0" strokeWidth="0.4" opacity="0.5">
            <line x1="0" y1="4.5" x2="44" y2="4.9" />
            <line x1="0" y1="17.5" x2="44" y2="17.1" />
          </g>
        </pattern>

        {/* Siltstone — intermediate laminae */}
        <pattern id={id("siltstone")} width="42" height="26" patternUnits="userSpaceOnUse">
          <rect width="42" height="26" fill={lithologySymbols.siltstone.fill} />
          <g stroke={lithologySymbols.siltstone.line} strokeWidth="0.6" opacity="0.55">
            {Array.from({ length: 5 }, (_, index) => (
              <line key={index} x1="0" y1={index * 4.6} x2="42" y2={index * 4.6} />
            ))}
          </g>
          <g fill={lithologySymbols.siltstone.deep} opacity="0.4">
            {Array.from({ length: 10 }, (_, index) => (
              <circle key={index} cx={(index * 13) % 40} cy={(index * 7) % 24} r="0.6" />
            ))}
          </g>
        </pattern>

        {/* Conglomerate — sorted clast outlines */}
        <pattern id={id("conglomerate")} width="46" height="46" patternUnits="userSpaceOnUse">
          <rect width="46" height="46" fill={lithologySymbols.conglomerate.fill} />
          <g fill={lithologySymbols.conglomerate.deep} fillOpacity="0.5" stroke={lithologySymbols.conglomerate.line} strokeWidth="0.7">
            <ellipse cx="9" cy="10" rx="4.2" ry="3" transform="rotate(18 9 10)" />
            <ellipse cx="26" cy="7" rx="3.2" ry="3.8" transform="rotate(-28 26 7)" />
            <ellipse cx="37" cy="20" rx="4.6" ry="3.2" transform="rotate(34 37 20)" />
            <ellipse cx="16" cy="27" rx="3.6" ry="4" transform="rotate(-12 16 27)" />
            <ellipse cx="33" cy="36" rx="4.4" ry="3" transform="rotate(8 33 36)" />
            <ellipse cx="7" cy="39" rx="3" ry="3.4" />
          </g>
          <g fill="none" stroke={lithologySymbols.conglomerate.line} strokeWidth="0.5" opacity="0.5">
            <path d="M0 46 L46 0" />
          </g>
        </pattern>

        {/* Evaporite — salt mottling with pale halite patches */}
        <pattern id={id("evaporite")} width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill={lithologySymbols.evaporite.fill} />
          <g fill="#e4dcef" opacity="0.55">
            <ellipse cx="10" cy="12" rx="7" ry="4" transform="rotate(-12 10 12)" />
            <ellipse cx="31" cy="9" rx="5" ry="3.4" />
            <ellipse cx="22" cy="28" rx="8" ry="4.6" transform="rotate(18 22 28)" />
            <ellipse cx="40" cy="38" rx="6" ry="3.6" transform="rotate(-22 40 38)" />
            <ellipse cx="6" cy="38" rx="4.4" ry="3" />
          </g>
          <g fill={lithologySymbols.evaporite.deep} opacity="0.4">
            <circle cx="19" cy="19" r="2.6" />
            <circle cx="38" cy="24" r="2" />
            <circle cx="29" cy="43" r="1.6" />
          </g>
        </pattern>

        {/* Basement — crystalline fabric with intersecting grain */}
        <pattern id={id("basement")} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={lithologySymbols.basement.fill} />
          <g stroke={lithologySymbols.basement.line} strokeWidth="0.75" opacity="0.6">
            {Array.from({ length: 7 }, (_, index) => (
              <line key={`a${index}`} x1={(index * 11) % 40} y1="0" x2={((index * 11) % 40) + 14} y2="40" />
            ))}
            {Array.from({ length: 6 }, (_, index) => (
              <line key={`b${index}`} x1="0" y1={(index * 9) % 40} x2="40" y2={((index * 9) % 40) - 11} />
            ))}
          </g>
          <g fill="#c6ccd4" opacity="0.35">
            <circle cx="9" cy="9" r="1.4" />
            <circle cx="27" cy="21" r="1" />
            <circle cx="17" cy="33" r="1.2" />
          </g>
        </pattern>

        {/* Alluvium — unsorted granules in a matrix */}
        <pattern id={id("alluvium")} width="36" height="36" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" fill={lithologySymbols.alluvium.fill} />
          <g fill={lithologySymbols.alluvium.deep} opacity="0.55">
            <ellipse cx="7" cy="8" rx="2.6" ry="1.8" />
            <ellipse cx="20" cy="5" rx="1.8" ry="1.4" />
            <ellipse cx="29" cy="14" rx="3" ry="2" transform="rotate(24 29 14)" />
            <ellipse cx="14" cy="21" rx="2.2" ry="1.6" transform="rotate(-18 14 21)" />
            <ellipse cx="30" cy="30" rx="2.8" ry="1.9" transform="rotate(10 30 30)" />
            <ellipse cx="8" cy="31" rx="1.6" ry="1.3" />
            <circle cx="22" cy="29" r="1.1" />
          </g>
          <g stroke={lithologySymbols.alluvium.line} strokeWidth="0.4" opacity="0.4">
            <path d="M0 26 H36" />
            <path d="M0 12 H36" strokeDasharray="3 4" />
          </g>
        </pattern>

        {/* Coal — bright vitrinite with dull bands */}
        <pattern id={id("coal")} width="30" height="20" patternUnits="userSpaceOnUse">
          <rect width="30" height="20" fill={lithologySymbols.coal.fill} />
          <g stroke="#6a6a6a" strokeWidth="0.6" opacity="0.6">
            <path d="M0 5 H30" />
            <path d="M0 14 H30" />
          </g>
        </pattern>

        <pattern id={id("unknown")} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill={lithologySymbols.unknown.fill} />
          <path d="M0 0 L16 16 M16 0 L0 16" stroke={lithologySymbols.unknown.line} strokeWidth="0.6" opacity="0.5" />
        </pattern>

        {/* Casing / cement conventions */}
        <pattern id={id("cement")} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#e6e0cd" />
          <rect width="4" height="10" fill="#c3b694" />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * A single formation unit drawn with its geological symbol plus the bedding
 * details that vary per unit, so two sandstone units never look identical.
 */
export function LithologyUnit({
  lithology,
  formationName,
  width,
  height,
  prefix = "geo",
  opacity = 1,
}: {
  lithology: Lithology;
  formationName: string;
  width: number;
  height: number;
  prefix?: string;
  opacity?: number;
}) {
  const symbol = lithologySymbols[lithology];
  const seed = seedFrom(formationName);
  const random = rng(seed);
  const clipId = `${prefix}-clip-${seed.toString(36)}`;
  const bedding: React.ReactNode[] = [];

  // Unit-specific internal detail drawn over the pattern.
  const beddingCount = Math.max(1, Math.floor(height / 26));
  for (let index = 1; index <= beddingCount; index += 1) {
    const y = (height / (beddingCount + 1)) * index;
    const dip = (random() - 0.5) * 4;
    bedding.push(<line key={`bed${index}`} x1="0" y1={y} x2={width} y2={y + dip} stroke={symbol.line} strokeWidth="0.7" opacity="0.5" />);
  }

  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill={symbol.fill} />
      <rect x="0" y="0" width={width} height={height} fill={`url(#${prefix}-${lithology})`} />
      <g clipPath={`url(#${clipId})`}>{bedding}</g>
      <rect x="0" y="0" width={width} height={height} fill="none" stroke={symbol.line} strokeWidth="0.8" opacity="0.75" />
    </g>
  );
}
