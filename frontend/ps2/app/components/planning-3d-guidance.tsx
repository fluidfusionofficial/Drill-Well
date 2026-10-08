"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { formationIntervals } from "@/lib/nwis-data";
import type { Well } from "@/lib/nwis-data";
import type { DirectionalPlan, LatLng, OffsetClearance } from "@/lib/well-planning";
import { ANTI_COLLISION_M, distanceKm, evaluateFormation, targetRadius } from "@/lib/well-planning";

const depthScale = 0.0075;
const groundRadius = 0.34;
const intervalColors = ["#b99a6e", "#d8a45e", "#c88159", "#5c9d94", "#83a87d", "#9982a8", "#4f998d", "#527f75", "#d1a051", "#687583"];

function makeLabel(text: string, color: string, width = 1.5) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = "rgba(8,20,26,0.78)";
    ctx.fillRect(0, 12, 512, 72);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 13, 510, 70);
    ctx.fillStyle = color;
    ctx.font = "600 38px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 49);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width, width * 0.19, 1);
  return { sprite, texture };
}

export function Planning3DGuidance({
  site,
  plan,
  pathPoints,
  offsets,
  clearances,
  pathEnd,
}: {
  site: LatLng;
  plan: DirectionalPlan;
  pathPoints: { depth: number; x: number; z: number }[];
  offsets: Well[];
  clearances: OffsetClearance[];
  pathEnd: LatLng;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    } catch {
      window.setTimeout(() => setUnavailable(true), 0);
      return;
    }

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(value: T) => {
      disposables.push(value);
      return value;
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor("#0d1a20", 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#0d1a20", 26, 52);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(14, 9, 17);
    camera.lookAt(0, -4, 0);

    scene.add(new THREE.HemisphereLight("#cfe9e6", "#16242a", 1.5));
    const key = new THREE.DirectionalLight("#fff2d8", 2.4);
    key.position.set(-8, 14, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#63c9e8", 0.9);
    fill.position.set(9, 3, -8);
    scene.add(fill);

    // Ground pad with radial survey grid
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(9, 72),
      new THREE.MeshStandardMaterial({ color: "#22403a", roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    scene.add(pad);

    const grid = new THREE.GridHelper(18, 36, "#5f8f80", "#33564c");
    grid.position.y = 0.01;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.28;
    });
    scene.add(grid);

    // 1 km scale ring
    for (const radiusKm of [1, 2, 3]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry((radiusKm / 1.6) * groundRadius - 0.004, (radiusKm / 1.6) * groundRadius + 0.004, 96),
        new THREE.MeshBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      scene.add(ring);
      const { sprite: label, texture: labelTexture } = makeLabel(`${radiusKm} km`, "#7dd3fc", 0.5);
      label.position.set((radiusKm / 1.6) * groundRadius, 0.09, -((radiusKm / 1.6) * groundRadius) * 0.72);
      scene.add(label);
      track(labelTexture);
    }

    // Stratigraphy — two cut sides so the section reads clearly
    const stratigraphy = new THREE.Group();
    formationIntervals.forEach((interval, index) => {
      const height = interval.thickness * depthScale;
      const material = new THREE.MeshStandardMaterial({
        color: intervalColors[index % intervalColors.length],
        roughness: 0.9,
        metalness: 0.02,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const y = -((interval.top + interval.bottom) / 2) * depthScale;
      for (const side of [-1, 1]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.4, height, 5.4), material);
        band.position.set(side * 2.05, y, -0.6);
        stratigraphy.add(band);
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, height, 0.03)),
          new THREE.LineBasicMaterial({ color: intervalColors[index % intervalColors.length], transparent: true, opacity: 0.75 }),
        );
        edge.position.set(side * 2.05, y, 2.1);
        stratigraphy.add(edge);
      }
    });
    scene.add(stratigraphy);

    // Depth axis
    const axis = new THREE.Group();
    axis.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.1, 0, 0), new THREE.Vector3(-3.1, -1161 * depthScale, 0)]),
        new THREE.LineBasicMaterial({ color: "#cfe3dd", transparent: true, opacity: 0.4 }),
      ),
    );
    [0, 300, 600, 900, 1150].forEach((depth) => {
      axis.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.22, -depth * depthScale, 0), new THREE.Vector3(-2.98, -depth * depthScale, 0)]),
          new THREE.LineBasicMaterial({ color: "#cfe3dd", transparent: true, opacity: 0.4 }),
        ),
      );
      const { sprite: label, texture: labelTexture } = makeLabel(`${depth} m`, "#cfe3dd", 0.62);
      label.position.set(-3.6, -depth * depthScale, 0);
      axis.add(label);
      track(labelTexture);
    });
    scene.add(axis);

    // Convert a lat/lng offset from the site into local scene units.
    const toLocal = (point: LatLng) => {
      const dLat = (point.lat - site.lat) * 110.574;
      const dLng = (point.lng - site.lng) * 111.32 * Math.cos((site.lat * Math.PI) / 180);
      return { x: dLng / 1.6, z: -dLat / 1.6 };
    };

    // Offset wells with keep-out envelopes
    const offsetGroup = new THREE.Group();
    clearances.forEach((clearance) => {
      const { x, z } = toLocal(clearance.well.coordinates);
      const wellDepth = clearance.well.actualDepth;
      const isNearest = clearance === clearances[0];
      const color = clearance.marginM < 0 ? "#ff6b6b" : clearance.marginM < 100 ? "#ffb454" : isNearest ? "#7dd3fc" : "#9fb4c0";

      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, Math.max(0.4, wellDepth * depthScale), 14),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.35 }),
      );
      bore.position.set(x, -((wellDepth * depthScale) / 2), z);
      offsetGroup.add(bore);

      const keepOut = new THREE.Mesh(
        new THREE.CylinderGeometry((ANTI_COLLISION_M / 1000 / 1.6) * groundRadius, (ANTI_COLLISION_M / 1000 / 1.6) * groundRadius, Math.max(0.4, wellDepth * depthScale), 22, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: clearance.marginM < 0 ? 0.3 : 0.12, side: THREE.DoubleSide, depthWrite: false }),
      );
      keepOut.position.set(x, -((wellDepth * depthScale) / 2), z);
      offsetGroup.add(keepOut);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.03, 8, 18),
        new THREE.MeshStandardMaterial({ color: "#d8b566", metalness: 0.6, roughness: 0.35 }),
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.set(x, 0.02, z);
      offsetGroup.add(collar);

      const { sprite: label, texture: labelTexture } = makeLabel(`${clearance.well.id} · ${(clearance.horizontalAtTargetM / 1000).toFixed(2)} km`, color, 1.5);
      label.position.set(x, 0.3, z);
      offsetGroup.add(label);
      track(labelTexture);
    });
    scene.add(offsetGroup);

    // Proposed well: pad, target radius cone, well path
    const proposed = new THREE.Group();
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(groundRadius * 0.24, groundRadius * 0.3, 48),
      new THREE.MeshBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.03;
    proposed.add(padRing);

    const surfaceCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, groundRadius * 0.3, 0.5, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    surfaceCone.position.y = 0.25;
    proposed.add(surfaceCone);

    const endLocal = toLocal(pathEnd);
    const radius = targetRadius(plan);
    const targetCone = new THREE.Mesh(
      new THREE.CylinderGeometry((radius / 1000 / 1.6) * groundRadius, (radius / 1000 / 1.6) * groundRadius * 0.35, 1.5, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    targetCone.position.set(endLocal.x, -plan.targetDepth * depthScale, endLocal.z);
    proposed.add(targetCone);

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry((radius / 1000 / 1.6) * groundRadius * 0.98, (radius / 1000 / 1.6) * groundRadius * 1.02, 48),
      new THREE.MeshBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.set(endLocal.x, -plan.targetDepth * depthScale, endLocal.z);
    proposed.add(targetRing);

    const curvePoints = pathPoints.map((point) => new THREE.Vector3(point.x, -point.depth * depthScale, point.z));
    const pathCurve = new THREE.CatmullRomCurve3(curvePoints);
    const pathLine = new THREE.Mesh(
      new THREE.TubeGeometry(pathCurve, 96, 0.035, 10, false),
      new THREE.MeshStandardMaterial({ color: "#a7f3d0", emissive: "#16a34a", emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.2 }),
    );
    proposed.add(pathLine);

    const bitMarker = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: "#fde68a", emissive: "#b45309", emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }),
    );
    bitMarker.position.set(endLocal.x, -plan.targetDepth * depthScale, endLocal.z);
    bitMarker.rotation.x = Math.PI;
    proposed.add(bitMarker);

    const { sprite: siteLabel, texture: siteLabelTexture } = makeLabel("PROPOSED PAD", "#4ade80", 1.6);
    siteLabel.position.set(0, 0.42, 0);
    proposed.add(siteLabel);
    track(siteLabelTexture);

    const { sprite: targetLabel, texture: targetLabelTexture } = makeLabel(`TARGET · r=${Math.round(radius)} m`, "#4ade80", 1.7);
    targetLabel.position.set(endLocal.x, -plan.targetDepth * depthScale + 0.34, endLocal.z);
    proposed.add(targetLabel);
    track(targetLabelTexture);
    scene.add(proposed);

    // Clearance tie-lines from the target to each offset well
    const ties = new THREE.Group();
    clearances.forEach((clearance) => {
      const { x, z } = toLocal(clearance.well.coordinates);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.03, z),
          new THREE.Vector3(endLocal.x, -plan.targetDepth * depthScale, endLocal.z),
        ]),
        new THREE.LineDashedMaterial({ color: clearance.marginM < 0 ? "#ff6b6b" : "#7dd3fc", transparent: true, opacity: 0.5, dashSize: 0.12, gapSize: 0.1 }),
      );
      line.computeLineDistances();
      ties.add(line);
    });
    scene.add(ties);

    // Planned TD depth plate
    const tdPlate = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.36, 48),
      new THREE.MeshBasicMaterial({ color: "#f59e0b", transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    tdPlate.rotation.x = -Math.PI / 2;
    tdPlate.position.set(endLocal.x, -plan.targetDepth * depthScale, endLocal.z);
    scene.add(tdPlate);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, -4.4, 0);
    controls.minDistance = 6;
    controls.maxDistance = 70;
    controls.update();

    const resizeObserver = new ResizeObserver(() => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);

    let frame: number | null = null;
    const started = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = (performance.now() - started) / 1000;
      padRing.rotation.z = elapsed * 0.25;
      targetRing.rotation.z = -elapsed * 0.18;
      surfaceCone.rotation.y = elapsed * 0.12;
      bitMarker.position.y = -plan.targetDepth * depthScale + Math.sin(elapsed * 2.2) * 0.04;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      disposables.forEach((item) => item.dispose());
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [clearances, offsets, pathEnd, pathPoints, plan, site]);

  const formation = evaluateFormation(formationIntervals[0].name, plan.targetDepth).interval;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[6px] bg-[#0d1a20]">
      <canvas
        ref={canvasRef}
        aria-label="3D placement guidance scene showing offset wells, proposed well path and target radius"
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />
      {unavailable && (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-[#0d1a20] px-6 text-center text-sm text-ink-3"
        >
          This browser does not support WebGL. Use the plan view and the check list to evaluate the site.
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 max-w-[280px] rounded-[6px] border border-line bg-surface p-3 text-xs text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="text-xs font-semibold text-ink">3D placement guidance</div>
        <div className="mt-2 space-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Proposed path and target radius
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-ok" />
            Offset wellbore and depth
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-high" />
            {ANTI_COLLISION_M} m keep-out cylinder
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-critical" />
            Anti-collision conflict
          </span>
        </div>
        <div className="mt-2.5 border-t border-line pt-2 text-xs text-ink-3">
          Target zone: {formation?.name ?? "Outside reference picks"} · TD {plan.targetDepth} m
        </div>
        <div className="text-xs text-ink-3">
          Surface offset from nearest: {(clearances[0] ? distanceKm(site, clearances[0].well.coordinates) : 0).toFixed(2)} km
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[4px] border border-line bg-surface/90 px-2.5 py-1.5 text-xs text-ink-2">
        Drag to orbit · Scroll to zoom · Right-drag to pan
      </div>
    </div>
  );
}

