import React from "react";
import { classifyEvent, HAZARD_CONFIG, HazardCategory } from "@/lib/taxonomy";

interface EventGlyphProps {
  type?: HazardCategory | string | null;
  category?: HazardCategory | string | null;
  size?: number;
  className?: string;
  dataSceneColor?: boolean;
  title?: string;
}

export function EventGlyph({
  type,
  category: catProp,
  size = 14,
  className = "",
  dataSceneColor = false,
  title,
}: EventGlyphProps) {
  const effectiveType = type ?? catProp;
  const category = (typeof effectiveType === "string" && effectiveType in HAZARD_CONFIG)
    ? (effectiveType as HazardCategory)
    : classifyEvent(effectiveType);

  const config = HAZARD_CONFIG[category] ?? HAZARD_CONFIG["Other NPT"];
  const color = config.color;
  const tooltip = title ?? config.label;

  const sceneProps = dataSceneColor ? { "data-scene-color": "true" } : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 align-middle ${className}`}
      aria-label={tooltip}
      {...sceneProps}
    >
      <title>{tooltip}</title>
      {config.shape === "inverted-triangle" && (
        <polygon points="2,3 14,3 8,13" fill={color} />
      )}
      {config.shape === "square" && (
        <rect x="3" y="3" width="10" height="10" fill={color} rx="1" />
      )}
      {config.shape === "diamond" && (
        <polygon points="8,2 14,8 8,14 2,8" fill={color} />
      )}
      {config.shape === "triangle" && (
        <polygon points="8,3 14,13 2,13" fill={color} />
      )}
      {config.shape === "hexagon" && (
        <polygon points="8,2 13.5,5 13.5,11 8,14 2.5,11 2.5,5" fill={color} />
      )}
      {config.shape === "circle" && (
        <circle cx="8" cy="8" r="5" fill={color} />
      )}
    </svg>
  );
}
