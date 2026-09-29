import React from "react";

export function LithologyDefs() {
  return (
    <defs>
      {/* sandstone #E8D5A3 dots */}
      <pattern id="litho-sandstone" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#E8D5A3" />
        <circle cx="2" cy="2" r="0.8" fill="#B8A473" />
        <circle cx="6" cy="6" r="0.8" fill="#B8A473" />
      </pattern>

      {/* siltstone #DCCFB0 dashes */}
      <pattern id="litho-siltstone" width="10" height="6" patternUnits="userSpaceOnUse">
        <rect width="10" height="6" fill="#DCCFB0" />
        <line x1="1" y1="2" x2="5" y2="2" stroke="#A89B7C" strokeWidth="1" />
        <line x1="6" y1="5" x2="10" y2="5" stroke="#A89B7C" strokeWidth="1" />
      </pattern>

      {/* claystone #BDBFB6 lines */}
      <pattern id="litho-claystone" width="8" height="6" patternUnits="userSpaceOnUse">
        <rect width="8" height="6" fill="#BDBFB6" />
        <line x1="0" y1="3" x2="8" y2="3" stroke="#8A8C84" strokeWidth="0.8" strokeDasharray="3 2" />
      </pattern>

      {/* limestone #BFCBDB bricks */}
      <pattern id="litho-limestone" width="16" height="8" patternUnits="userSpaceOnUse">
        <rect width="16" height="8" fill="#BFCBDB" />
        <line x1="0" y1="0" x2="16" y2="0" stroke="#8E9AA8" strokeWidth="0.8" />
        <line x1="0" y1="4" x2="16" y2="4" stroke="#8E9AA8" strokeWidth="0.8" />
        <line x1="8" y1="0" x2="8" y2="4" stroke="#8E9AA8" strokeWidth="0.8" />
        <line x1="0" y1="4" x2="0" y2="8" stroke="#8E9AA8" strokeWidth="0.8" />
        <line x1="16" y1="4" x2="16" y2="8" stroke="#8E9AA8" strokeWidth="0.8" />
      </pattern>

      {/* dolomite #CDC3DE rhombs */}
      <pattern id="litho-dolomite" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#CDC3DE" />
        <path d="M6 1 L11 6 L6 11 L1 6 Z" fill="none" stroke="#9C92AD" strokeWidth="0.8" />
      </pattern>

      {/* evaporite #E3CFE0 hatch */}
      <pattern id="litho-evaporite" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#E3CFE0" />
        <path d="M0 8 L8 0 M0 0 L8 8" stroke="#B09CAD" strokeWidth="0.8" />
      </pattern>

      {/* basement #9AA0AA crosses */}
      <pattern id="litho-basement" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#9AA0AA" />
        <path d="M3 5 L7 5 M5 3 L5 7" stroke="#6C727C" strokeWidth="0.9" />
      </pattern>

      {/* alluvium #EADFC3 stipple */}
      <pattern id="litho-alluvium" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#EADFC3" />
        <circle cx="2" cy="3" r="0.6" fill="#B2A78B" />
        <circle cx="6" cy="2" r="0.5" fill="#B2A78B" />
        <circle cx="4" cy="6" r="0.7" fill="#B2A78B" />
      </pattern>
    </defs>
  );
}

/**
 * Returns the fill ID for a formation name based on its lithology keywords.
 */
export function getLithologyFillId(formationName: string): string {
  const lower = formationName.toLowerCase();
  if (lower.includes("dolomit") || lower.includes("bilara")) return "url(#litho-dolomite)";
  if (lower.includes("limestone") || lower.includes("carbonate") || lower.includes("calcareous")) return "url(#litho-limestone)";
  if (lower.includes("sandstone") || lower.includes("jodhpur")) return "url(#litho-sandstone)";
  if (lower.includes("siltstone")) return "url(#litho-siltstone)";
  if (lower.includes("clay") || lower.includes("shale")) return "url(#litho-claystone)";
  if (lower.includes("evaporite") || lower.includes("anhydrite") || lower.includes("salt") || lower.includes("hanseran")) return "url(#litho-evaporite)";
  if (lower.includes("basement") || lower.includes("granite") || lower.includes("malani")) return "url(#litho-basement)";
  if (lower.includes("alluvium") || lower.includes("bap") || lower.includes("badhaura")) return "url(#litho-alluvium)";
  return "url(#litho-sandstone)";
}
