"use client";

import { useEffect, useRef, useState } from "react";

export interface ChartDimensions {
  width: number;
  height: number;
}

export function useChartSize(defaultWidth = 600, defaultHeight = 400) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartDimensions>({
    width: defaultWidth,
    height: defaultHeight,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Measure initially
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    }

    let frameId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (width > 0) {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          setSize({
            width: Math.floor(width),
            height: height > 0 ? Math.floor(height) : defaultHeight,
          });
        });
      }
    });

    observer.observe(element);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [defaultHeight]);

  return { ref, width: size.width, height: size.height };
}
