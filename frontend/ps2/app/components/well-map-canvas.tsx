"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import { wellEvents } from "@/lib/nwis-data";
import type { Well } from "@/lib/nwis-data";

if (typeof window !== "undefined" && typeof maplibregl.setWorkerUrl === "function") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

export interface WellMapCanvasProps {
  wells: Well[];
  activeWell: Well;
  radiusKm: number;
  onWellSelect?: (well: Well) => void;
  focusKey?: number;
}

const statusColors: Record<string, string> = {
  Active: "#1D4ED8",
  Monitor: "#A96F00",
  "Drilling Complete": "#2E7D32",
  Completed: "#2E7D32",
  Standby: "#D9560B",
  Producing: "#2E7D32",
  Suspended: "#A96F00",
  Abandoned: "#667085",
};

export type MapLibreStyleId = "openfreemap" | "demotiles" | "osm";

interface StyleOption {
  id: MapLibreStyleId;
  name: string;
  label: string;
  style: string | maplibregl.StyleSpecification;
  badge: string;
}

const MAP_STYLES: StyleOption[] = [
  {
    id: "openfreemap",
    name: "OpenFreeMap Positron (Vector)",
    label: "Vector (Positron)",
    style: "https://tiles.openfreemap.org/styles/positron",
    badge: "OpenFreeMap",
  },
  {
    id: "demotiles",
    name: "MapLibre Demotiles (Vector)",
    label: "MapLibre Demo",
    style: "https://demotiles.maplibre.org/style.json",
    badge: "MapLibre",
  },
  {
    id: "osm",
    name: "OpenStreetMap (Standard)",
    label: "OpenStreetMap",
    style: {
      version: 8,
      sources: {
        "osm-raster-source": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-raster-layer",
          type: "raster",
          source: "osm-raster-source",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
    badge: "OSM",
  },
];

function distanceKm(from: Well, to: Well) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(to.coordinates.lat - from.coordinates.lat);
  const deltaLng = radians(to.coordinates.lng - from.coordinates.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(from.coordinates.lat)) *
      Math.cos(radians(to.coordinates.lat)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Generate GeoJSON Polygon for circle radius around active well
function createCircleGeoJSON(centerLng: number, centerLat: number, radiusInKm: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const lng = centerLng + distanceX * Math.cos(theta);
    const lat = centerLat + distanceY * Math.sin(theta);
    coords.push([lng, lat]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  };
}

// Generate GeoJSON LineString for offset tie-lines
function createLinksGeoJSON(activeLng: number, activeLat: number, offsets: Well[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = offsets.map((well) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [activeLng, activeLat],
        [well.coordinates.lng, well.coordinates.lat],
      ],
    },
    properties: {
      wellId: well.id,
    },
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

export function WellMapCanvas({
  wells,
  activeWell,
  radiusKm,
  onWellSelect,
  focusKey,
}: WellMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [activeStyleId, setActiveStyleId] = useState<MapLibreStyleId>("openfreemap");
  const [showRadius, setShowRadius] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [mapCenter, setMapCenter] = useState({ lat: activeWell.coordinates.lat, lng: activeWell.coordinates.lng });
  const [mapZoom, setMapZoom] = useState(11);

  // Sync radius & links GeoJSON layers into MapLibre
  const updateVectorLayersRef = useRef<(mapInstance: maplibregl.Map) => void>(() => {});

  const updateVectorLayers = useCallback(
    (mapInstance: maplibregl.Map) => {
      if (!mapInstance.isStyleLoaded()) {
        mapInstance.once("styledata", () => updateVectorLayersRef.current(mapInstance));
        return;
      }

      const circleData = createCircleGeoJSON(
        activeWell.coordinates.lng,
        activeWell.coordinates.lat,
        radiusKm,
      );

      const offsetWells = wells.filter((w) => w.id !== activeWell.id);
      const linksData = createLinksGeoJSON(
        activeWell.coordinates.lng,
        activeWell.coordinates.lat,
        offsetWells,
      );

      // 1. Radius Source & Layers
      const radiusSource = mapInstance.getSource("radius-source") as maplibregl.GeoJSONSource | undefined;
      if (radiusSource) {
        radiusSource.setData(circleData);
      } else {
        mapInstance.addSource("radius-source", {
          type: "geojson",
          data: circleData,
        });

        mapInstance.addLayer({
          id: "radius-fill",
          type: "fill",
          source: "radius-source",
          paint: {
            "fill-color": "#1D4ED8",
            "fill-opacity": 0.1,
          },
        });

        mapInstance.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius-source",
          paint: {
            "line-color": "#1D4ED8",
            "line-width": 1.5,
            "line-dasharray": [3, 3],
          },
        });
      }

      // 2. Links Source & Layer
      const linksSource = mapInstance.getSource("links-source") as maplibregl.GeoJSONSource | undefined;
      if (linksSource) {
        linksSource.setData(linksData);
      } else {
        mapInstance.addSource("links-source", {
          type: "geojson",
          data: linksData,
        });

        mapInstance.addLayer({
          id: "links-line",
          type: "line",
          source: "links-source",
          paint: {
            "line-color": "#4A5565",
            "line-width": 1.2,
            "line-opacity": 0.45,
            "line-dasharray": [2, 3],
          },
        });
      }

      // Visibility toggles
      if (mapInstance.getLayer("radius-fill")) {
        mapInstance.setLayoutProperty("radius-fill", "visibility", showRadius ? "visible" : "none");
      }
      if (mapInstance.getLayer("radius-line")) {
        mapInstance.setLayoutProperty("radius-line", "visibility", showRadius ? "visible" : "none");
      }
      if (mapInstance.getLayer("links-line")) {
        mapInstance.setLayoutProperty("links-line", "visibility", showLinks ? "visible" : "none");
      }
    },
    [activeWell.coordinates.lat, activeWell.coordinates.lng, activeWell.id, radiusKm, showLinks, showRadius, wells],
  );

  useEffect(() => {
    updateVectorLayersRef.current = updateVectorLayers;
  }, [updateVectorLayers]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (typeof window !== "undefined" && typeof maplibregl.setWorkerUrl === "function") {
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    }

    const initialStyle = MAP_STYLES.find((s) => s.id === "openfreemap")?.style ?? "https://tiles.openfreemap.org/styles/positron";

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        center: [activeWell.coordinates.lng, activeWell.coordinates.lat],
        zoom: 11,
        attributionControl: false,
      });
    } catch (err) {
      console.error("MapLibre GL failed to initialize:", err);
      return;
    }

    // Gracefully catch any tile/source loading warnings
    map.on("error", (e) => {
      if (e?.error) {
        console.warn("MapLibre GL non-fatal event:", e.error.message || e.error);
      }
    });

    // ResizeObserver ensures canvas always fills the dynamic container correctly
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Navigation and Scale controls
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      "top-right",
    );

    map.addControl(
      new maplibregl.ScaleControl({
        unit: "metric",
        maxWidth: 120,
      }),
      "bottom-right",
    );

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      map.resize();
      updateVectorLayers(map);
    });

    map.on("style.load", () => {
      updateVectorLayers(map);
    });

    map.on("move", () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
      setMapZoom(Math.round(map.getZoom() * 10) / 10);
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [activeWell.coordinates.lat, activeWell.coordinates.lng, updateVectorLayers]);

  // Handle style change
  const handleStyleChange = (styleId: MapLibreStyleId) => {
    setActiveStyleId(styleId);
    const chosen = MAP_STYLES.find((s) => s.id === styleId);
    if (chosen && mapRef.current) {
      mapRef.current.setStyle(chosen.style);
    }
  };

  // Update vector layers when props change
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateVectorLayers(mapRef.current);
    }
  }, [updateVectorLayers]);

  // Fly to active well when activeWell or focusKey changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [activeWell.coordinates.lng, activeWell.coordinates.lat],
      essential: true,
      duration: 650,
    });
  }, [activeWell.coordinates.lat, activeWell.coordinates.lng, focusKey]);

  // Render DOM markers with MapLibre GL
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    wells.forEach((well) => {
      const isActive = well.id === activeWell.id;
      const statusColor = statusColors[well.status] ?? "#667085";
      const strokeColor = isActive ? "#1D4ED8" : "#4A5565";
      const fillColor = isActive ? "#EAF0FE" : "#FFFFFF";
      const dotColor = isActive ? "#1D4ED8" : statusColor;
      const eventCount = wellEvents.filter((e) => e.wellId === well.id).length;
      const distance = distanceKm(activeWell, well);

      // Create marker container element
      const el = document.createElement("div");
      el.className = "nwis-maplibre-marker";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.cursor = "pointer";
      el.style.userSelect = "none";

      el.innerHTML = `
        <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;">
          ${isActive ? `<div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid #1D4ED8;opacity:0.6;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isActive ? "2.5" : "1.5"}"/>
            <circle cx="12" cy="12" r="4" fill="${dotColor}"/>
          </svg>
        </div>
        <span style="
          background:#FFFFFF;
          border:1px solid ${isActive ? "#1D4ED8" : "#E1E5EA"};
          border-radius:4px;
          padding:1px 5px;
          font-size:12px;
          font-weight:${isActive ? "600" : "500"};
          color:${isActive ? "#1D4ED8" : "#16202C"};
          margin-top:2px;
          box-shadow:0 1px 3px rgba(0,0,0,0.1);
          white-space:nowrap;
        ">${well.id}</span>
      `;

      // Hover scale effect
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.12)";
        el.style.zIndex = "1000";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1.0)";
        el.style.zIndex = isActive ? "500" : "10";
      });

      // MapLibre popup with rich engineering workstation card
      const popupContent = document.createElement("div");
      popupContent.style.minWidth = "220px";
      popupContent.style.padding = "2px";
      popupContent.innerHTML = `
        <div style="font-size:12px;font-weight:600;color:${isActive ? "#1D4ED8" : "#4A5565"};margin-bottom:4px;">
          ${isActive ? "Selected active well" : "Offset candidate well"}
        </div>
        <div style="font-size:14px;font-weight:600;color:#16202C;line-height:1.2;">
          ${well.id} · ${well.location}
        </div>
        <div style="font-size:12px;color:#4A5565;margin-top:2px;">
          ${well.formation} · ${well.profile}
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid #E1E5EA;font-size:12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${statusColor};"></span>
          <span style="font-weight:500;color:#16202C;">${well.status}</span>
          <span style="color:#667085;">· Rig: ${well.rig}</span>
        </div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #E1E5EA;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;">
          <div><span style="color:#667085;">Depth:</span> <strong style="font-variant-numeric:tabular-nums;color:#16202C;">${well.currentDepth.toLocaleString("en-IN")} m</strong></div>
          <div><span style="color:#667085;">Target TD:</span> <strong style="font-variant-numeric:tabular-nums;color:#16202C;">${well.targetDepth.toLocaleString("en-IN")} m</strong></div>
          <div><span style="color:#667085;">Separation:</span> <strong style="font-variant-numeric:tabular-nums;color:#16202C;">${distance.toFixed(1)} km</strong></div>
          <div><span style="color:#667085;">Events:</span> <strong style="color:#16202C;">${eventCount} records</strong></div>
        </div>
        ${
          !isActive
            ? `<button id="btn-select-${well.id}" style="
                margin-top:10px;
                width:100%;
                background-color:#1D4ED8;
                color:#FFFFFF;
                border:none;
                border-radius:4px;
                padding:5px 8px;
                font-size:12px;
                font-weight:500;
                cursor:pointer;
              ">Select as active well</button>`
            : ""
        }
      `;

      const popup = new maplibregl.Popup({
        offset: [0, -18],
        closeButton: true,
        closeOnClick: false,
        className: "nwis-maplibre-popup",
      }).setDOMContent(popupContent);

      // Handle button inside popup
      popup.on("open", () => {
        const btn = document.getElementById(`btn-select-${well.id}`);
        if (btn) {
          btn.addEventListener("click", () => {
            onWellSelect?.(well);
            popup.remove();
          });
        }
      });

      // Marker click triggers selection and opens popup
      el.addEventListener("click", () => {
        onWellSelect?.(well);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([well.coordinates.lng, well.coordinates.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [activeWell, onWellSelect, wells]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-canvas">
      {/* MapLibre GL WebGL container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top-Right Open-Source Map Tools Overlay */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <div className="rounded-[6px] border border-line bg-surface p-2 shadow-sm text-xs text-ink max-w-[210px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-line mb-1.5">
            <span className="font-semibold text-xs text-ink">MapLibre Engine</span>
            <span className="rounded-[4px] bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
              Open Source
            </span>
          </div>

          {/* Style selection */}
          <div className="space-y-1">
            {MAP_STYLES.map((style) => (
              <label
                key={style.id}
                className="flex items-center gap-2 cursor-pointer rounded-[4px] px-1.5 py-1 transition hover:bg-surface-muted"
              >
                <input
                  type="radio"
                  name="maplibre-style"
                  checked={activeStyleId === style.id}
                  onChange={() => handleStyleChange(style.id)}
                  className="accent-[#1D4ED8]"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{style.label}</span>
              </label>
            ))}
          </div>

          {/* Vector layer overlays */}
          <div className="mt-2 pt-1.5 border-t border-line space-y-1">
            <label className="flex items-center gap-2 cursor-pointer rounded-[4px] px-1.5 py-0.5 transition hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={showRadius}
                onChange={(e) => setShowRadius(e.target.checked)}
                className="accent-[#1D4ED8]"
              />
              <span className="text-xs text-ink-2">Context radius ({radiusKm} km)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-[4px] px-1.5 py-0.5 transition hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={showLinks}
                onChange={(e) => setShowLinks(e.target.checked)}
                className="accent-[#1D4ED8]"
              />
              <span className="text-xs text-ink-2">Offset tie-lines</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom-Left Live Readout Pill */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-[4px] border border-line bg-surface/95 px-2.5 py-1.5 text-xs text-ink-2 shadow-sm">
        <div className="tabular-nums font-medium text-ink">
          {mapCenter.lat.toFixed(4)}° N · {mapCenter.lng.toFixed(4)}° E
        </div>
        <div className="text-xs text-ink-3">
          Zoom {mapZoom} · {wells.length} wells on field
        </div>
      </div>
    </div>
  );
}
