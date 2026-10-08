import React from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = "",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height }}
      className={`animate-pulse rounded-[4px] bg-surface-muted border border-line/40 ${className}`}
    />
  );
}
