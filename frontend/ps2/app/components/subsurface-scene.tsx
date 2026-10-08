"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Activity, ChevronRight, CircleDot, Layers3, Waves } from "lucide-react";
import { formationAtReferenceDepth, formationIntervals, wellEvents } from "@/lib/nwis-data";
import type { EventRecord, Well } from "@/lib/nwis-data";

const depthScale = 0.008;
const boreRadius = 0.42;
const pipeRadius = 0.18;
const intervalColors = ["#b99a6e", "#d8a45e", "#c88159", "#5c9d94", "#83a87d", "#9982a8", "#4f998d", "#527f75", "#d1a051", "#687583"];

type LithologyKey = "alluvium" | "sandstone" | "mixed" | "carbonate" | "claystone" | "evaporite" | "basement";

const lithologyKeys: LithologyKey[] = ["alluvium", "sandstone", "mixed", "carbonate", "carbonate", "evaporite", "carbonate", "carbonate", "sandstone", "basement"];

const lithologyTint: Record<LithologyKey, string> = {
  alluvium: "#c7ab7c",
  sandstone: "#d8b078",
  mixed: "#c8ac86",
  carbonate: "#9fb6bb",
  claystone: "#a9b0a4",
  evaporite: "#b6a7c2",
  basement: "#78808c",
};
const referenceWellId = "WX-07";
const referenceEvents = wellEvents.filter((event) => event.wellId === referenceWellId);
const wellboreZ = 1.65;
const standLengthMeters = 27;
const bitDrop = 0.08;

type OperationMode = "hold" | "drill" | "trip";

export type SubsurfaceLayers = { surface: boolean; formations: boolean; drillstring: boolean; events: boolean };

type SubsurfaceSceneProps = {
  well: Well;
  depth: number;
  isPlaying: boolean;
  verticalExaggeration: number;
  layers: SubsurfaceLayers;
  onEventSelect: (event: EventRecord) => void;
  onDepthChange?: (depth: number) => void;
};

function createRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeRockTexture(base: string, seed: number) {
  const random = createRandom(seed);
  return makeTexture(256, 256, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);

    for (let speck = 0; speck < 2600; speck += 1) {
      const x = random() * 256;
      const y = random() * 256;
      const size = random() * 2.4 + 0.4;
      const shade = random();
      ctx.fillStyle = shade > 0.62 ? `rgba(255,248,232,${0.05 + random() * 0.14})` : `rgba(28,22,16,${0.05 + random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let bedding = 0; bedding < 14; bedding += 1) {
      const y = random() * 256;
      const thickness = 0.6 + random() * 2.4;
      ctx.fillStyle = `rgba(46,34,24,${0.06 + random() * 0.12})`;
      ctx.fillRect(0, y, 256, thickness);
      ctx.fillStyle = `rgba(255,244,222,${0.04 + random() * 0.07})`;
      ctx.fillRect(0, y + thickness, 256, 0.8);
    }

    for (let clast = 0; clast < 26; clast += 1) {
      const x = random() * 256;
      const y = random() * 256;
      const radius = 2.5 + random() * 6;
      ctx.strokeStyle = `rgba(255,245,225,0.1)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (0.5 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function makePipeTexture() {
  const random = createRandom(41);
  return makeTexture(96, 256, (ctx) => {
    ctx.fillStyle = "#cfd8d4";
    ctx.fillRect(0, 0, 96, 256);

    for (let streak = 0; streak < 120; streak += 1) {
      const x = random() * 96;
      ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${random() * 0.12})` : `rgba(80,96,94,${random() * 0.14})`;
      ctx.fillRect(x, 0, 0.6 + random() * 1.4, 256);
    }

    for (let thread = 0; thread < 32; thread += 1) {
      const y = thread * 8;
      ctx.fillStyle = "rgba(52,66,68,0.42)";
      ctx.fillRect(0, y, 96, 1.6);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(0, y + 1.6, 96, 0.7);
    }

    ctx.fillStyle = "rgba(24,32,34,0.3)";
    ctx.fillRect(0, 118, 96, 20);
    ctx.fillStyle = "rgba(230,236,232,0.24)";
    ctx.fillRect(0, 118, 96, 3);
  });
}

function makeFlowTexture() {
  return makeTexture(48, 96, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 48, 0);
    gradient.addColorStop(0, "#0d4a54");
    gradient.addColorStop(0.5, "#2ad3cf");
    gradient.addColorStop(1, "#0d4a54");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 96);
    for (let band = 0; band < 22; band += 1) {
      const y = band * 4.4;
      ctx.fillStyle = `rgba(180,255,246,${0.05 + Math.random() * 0.09})`;
      ctx.fillRect(0, y, 48, 1.4);
    }
  });
}

function makeGrateTexture() {
  return makeTexture(64, 64, (ctx) => {
    ctx.fillStyle = "#5c6a66";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = "#2f3b39";
    ctx.lineWidth = 4;
    for (let x = 0; x <= 64; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }
    ctx.strokeStyle = "#7f8f8a";
    ctx.lineWidth = 1.2;
    for (let y = 0; y <= 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
  });
}

function makeTankTexture() {
  const random = createRandom(7);
  return makeTexture(64, 64, (ctx) => {
    ctx.fillStyle = "#2d3b30";
    ctx.fillRect(0, 0, 64, 64);
    for (let ripple = 0; ripple < 90; ripple += 1) {
      const x = random() * 64;
      const y = random() * 64;
      ctx.fillStyle = `rgba(120,150,120,${random() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.5 + random() * 5, 0.7 + random() * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makeLabelSprite(text: string, color: string) {
  const texture = makeTexture(256, 72, (ctx) => {
    ctx.clearRect(0, 0, 256, 72);
    ctx.fillStyle = "rgba(8,20,26,0.62)";
    ctx.fillRect(0, 14, 256, 44);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(0.7, 14.7, 254.6, 42.6);
    ctx.fillStyle = color;
    ctx.font = "600 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 37);
  });
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.92, 0.26, 1);
  return { sprite, texture, material };
}

export function SubsurfaceScene({ well, depth, isPlaying, verticalExaggeration, layers, onEventSelect, onDepthChange }: SubsurfaceSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<THREE.Group | null>(null);
  const drillstringRef = useRef<THREE.Group | null>(null);
  const drilledIntervalRef = useRef<THREE.Group | null>(null);
  const bitRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const eventRefs = useRef<{ mesh: THREE.Mesh; event: EventRecord }[]>([]);
  const bandMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const bandEdgesRef = useRef<THREE.LineSegments[][]>([]);
  const circulationParticlesRef = useRef<THREE.Mesh[]>([]);
  const cursorDepthRef = useRef(depth);
  const layerRefs = useRef<SubsurfaceLayers>(layers);
  const playingRef = useRef(isPlaying);
  const exaggerationRef = useRef(verticalExaggeration);
  const onEventSelectRef = useRef(onEventSelect);
  const onDepthChangeRef = useRef(onDepthChange);
  const initialDepthRef = useRef(depth);
  const frameRef = useRef<number | null>(null);
  const operationRef = useRef<OperationMode>("hold");
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [referencePanel, setReferencePanel] = useState<"formations" | "events">("formations");
  const [operation, setOperation] = useState<OperationMode>("hold");
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    operationRef.current = operation;
  }, [operation]);

  useEffect(() => {
    layerRefs.current = layers;
    playingRef.current = isPlaying;
    exaggerationRef.current = verticalExaggeration;
    onEventSelectRef.current = onEventSelect;
    onDepthChangeRef.current = onDepthChange;
  }, [isPlaying, layers, onEventSelect, onDepthChange, verticalExaggeration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
    } catch {
      window.setTimeout(() => setWebglAvailable(false), 0);
      return;
    }

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(value: T) => {
      disposables.push(value);
      return value;
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor("#101e25", 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#101e25", 22, 42);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(12, 7.2, 15);
    camera.lookAt(0, -4.5, 0);
    cameraRef.current = camera;

    scene.add(new THREE.HemisphereLight("#cfe9e6", "#1d2a30", 1.55));
    const keyLight = new THREE.DirectionalLight("#fff3d8", 2.6);
    keyLight.position.set(-6, 12, 9);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight("#5fb6dd", 0.95);
    fillLight.position.set(8, 2, -9);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight("#9fe8ff", 1.15);
    rimLight.position.set(-9, -4, -6);
    scene.add(rimLight);

    const floodLights: THREE.SpotLight[] = [];
    [[-2.3, -2.4], [2.3, -2.4]].forEach(([mastX, mastZ]) => {
      const flood = new THREE.SpotLight("#ffd9a0", 2.2, 15, 0.58, 0.65, 1.4);
      flood.position.set(mastX, 2.35, mastZ);
      flood.target.position.set(0, 0.2, wellboreZ);
      scene.add(flood, flood.target);
      floodLights.push(flood);
    });
    const wellheadGlow = new THREE.PointLight("#ffd39a", 1.1, 3.4, 2);
    wellheadGlow.position.set(0, 0.7, wellboreZ);
    scene.add(wellheadGlow);
    const bitGlow = new THREE.PointLight("#63f0d8", 0, 2.6, 2);
    scene.add(bitGlow);

    const depthSpace = new THREE.Group();
    const stratigraphy = new THREE.Group();
    const bandMaterials: THREE.MeshStandardMaterial[] = [];
    const bandEdges: THREE.LineSegments[][] = [];    formationIntervals.forEach((interval, index) => {
      const height = Math.max(interval.thickness * depthScale, 0.16);
      const rockTexture = track(makeRockTexture(lithologyTint[lithologyKeys[index % lithologyKeys.length]], index * 37 + 11));
      rockTexture.wrapS = THREE.RepeatWrapping;
      rockTexture.wrapT = THREE.RepeatWrapping;
      rockTexture.repeat.set(1.4, Math.max(1, interval.thickness / 90));
      const material = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: rockTexture,
        roughness: 0.88,
        metalness: 0.02,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      bandMaterials[index] = material;
      const layerY = -((interval.top + interval.bottom) / 2) * depthScale;
      const cutawayFaceZ = 1.1;
      for (const side of [-1, 1]) {
        const geometry = new THREE.BoxGeometry(2.5, height, 5.1);
        const band = new THREE.Mesh(geometry, material);
        band.position.set(side * 1.88, layerY, 0);
        stratigraphy.add(band);

        const cutawayEdge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(2.5, height, 0.035)),
          new THREE.LineBasicMaterial({ color: intervalColors[index % intervalColors.length], transparent: true, opacity: 0.9 }),
        );
        cutawayEdge.position.set(side * 1.88, layerY, cutawayFaceZ);
        stratigraphy.add(cutawayEdge);
        bandEdges[index] = [...(bandEdges[index] ?? []), cutawayEdge];

        const thinSection = new THREE.Mesh(
          new THREE.BoxGeometry(2.48, Math.max(0.012, height * 0.022), 0.025),
          new THREE.MeshBasicMaterial({ color: "#fff2d9", transparent: true, opacity: 0.12 }),
        );
        thinSection.position.set(side * 1.88, layerY, cutawayFaceZ + 0.022);
        stratigraphy.add(thinSection);

        const laminaCount = Math.max(1, Math.round(interval.thickness / 34));
        for (let lamina = 1; lamina < laminaCount; lamina += 1) {
          const laminaY = layerY - height / 2 + (height * lamina) / laminaCount;
          const laminaBand = new THREE.Mesh(
            new THREE.BoxGeometry(2.46, 0.006, 5.06),
            new THREE.MeshBasicMaterial({ color: intervalColors[index % intervalColors.length], transparent: true, opacity: 0.3 }),
          );
          laminaBand.position.set(side * 1.88, laminaY, 0);
          stratigraphy.add(laminaBand);
        }
      }
    });
    depthSpace.add(stratigraphy);
    const stratigraphyRef = stratigraphy;
    bandMaterialsRef.current = bandMaterials;
    bandEdgesRef.current = bandEdges;

    const surfaceGroup = new THREE.Group();
    const terrainMaterial = new THREE.MeshStandardMaterial({ color: "#27443c", roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), terrainMaterial);
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.set(0, -0.02, -10.6);
    surfaceGroup.add(farGround);
    const farGroundSide = new THREE.Mesh(new THREE.PlaneGeometry(11, 30), terrainMaterial);
    farGroundSide.rotation.x = -Math.PI / 2;
    farGroundSide.position.set(-12.5, -0.025, -2);
    surfaceGroup.add(farGroundSide);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 7.2),
      new THREE.MeshStandardMaterial({ color: "#356556", roughness: 0.95, metalness: 0.02, transparent: true, opacity: 0.84, side: THREE.DoubleSide }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.025;
    surfaceGroup.add(surface);

    const surfaceGrid = new THREE.GridHelper(8, 16, "#88b6a6", "#51796d");
    surfaceGrid.position.y = 0.055;
    const gridMaterials = Array.isArray(surfaceGrid.material) ? surfaceGrid.material : [surfaceGrid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.24;
    });
    surfaceGroup.add(surfaceGrid);

    const tankTexture = track(makeTankTexture());
    tankTexture.wrapS = THREE.RepeatWrapping;
    tankTexture.wrapT = THREE.RepeatWrapping;
    tankTexture.repeat.set(2, 1);

    const camp = new THREE.Group();
    const tankShellMaterial = new THREE.MeshStandardMaterial({ color: "#546a63", roughness: 0.72, metalness: 0.18 });
    const tankLiquidMaterial = new THREE.MeshStandardMaterial({
      color: "#5c7a58",
      map: tankTexture,
      roughness: 0.24,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
      emissive: "#16301f",
      emissiveIntensity: 0.3,
    });
    for (let tank = 0; tank < 4; tank += 1) {
      const tankGroup = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 1.05), tankShellMaterial);
      shell.position.y = 0.36;
      tankGroup.add(shell);
      const liquid = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.92), tankLiquidMaterial);
      liquid.rotation.x = -Math.PI / 2;
      liquid.position.y = 0.7;
      tankGroup.add(liquid);
      const rim = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.15, 0.72, 1.05)),
        new THREE.LineBasicMaterial({ color: "#8fa7a0", transparent: true, opacity: 0.6 }),
      );
      rim.position.y = 0.36;
      tankGroup.add(rim);
      tankGroup.position.set(-2.5 + tank * 1.4, 0, -3.5);
      camp.add(tankGroup);
    }

    const shakers = new THREE.Group();
    const shakerBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.46, 0.85), new THREE.MeshStandardMaterial({ color: "#4c5f66", roughness: 0.66, metalness: 0.24 }));
    shakerBody.position.y = 0.6;
    shakers.add(shakerBody);
    for (let deck = 0; deck < 2; deck += 1) {
      const chute = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.78), new THREE.MeshStandardMaterial({ color: "#94a6a0", roughness: 0.5, metalness: 0.4 }));
      chute.position.set(-0.4 + deck * 0.8, 0.85, 0);
      chute.rotation.z = deck === 0 ? 0.16 : -0.16;
      shakers.add(chute);
    }
    for (let leg = 0; leg < 4; leg += 1) {
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), new THREE.MeshStandardMaterial({ color: "#39474a", roughness: 0.6, metalness: 0.4 }));
      legMesh.position.set((leg % 2 === 0 ? -0.75 : 0.75), 0.2, leg < 2 ? -0.35 : 0.35);
      shakers.add(legMesh);
    }
    shakers.position.set(3.7, 0, -3.1);
    camp.add(shakers);

    const pipeRack = new THREE.Group();
    const rackFrameMaterial = new THREE.MeshStandardMaterial({ color: "#6d5a3f", roughness: 0.78, metalness: 0.12 });
    const rackPipeMaterial = new THREE.MeshStandardMaterial({ color: "#b9c4bf", roughness: 0.42, metalness: 0.36 });
    for (let beam = 0; beam < 2; beam += 1) {
      const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.7), rackFrameMaterial);
      beamMesh.position.set(beam === 0 ? -0.45 : 0.45, 0.24, 0);
      pipeRack.add(beamMesh);
    }
    for (let pipeIndex = 0; pipeIndex < 3; pipeIndex += 1) {
      const rackPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.9, 12), rackPipeMaterial);
      rackPipe.rotation.x = Math.PI / 2;
      rackPipe.position.set(-0.45 + pipeIndex * 0.45, 0.4, 0);
      pipeRack.add(rackPipe);
    }
    pipeRack.position.set(-4.3, 0, -2.1);
    camp.add(pipeRack);

    const generator = new THREE.Group();
    const generatorBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.72), new THREE.MeshStandardMaterial({ color: "#3f5a52", roughness: 0.72, metalness: 0.2 }));
    generatorBody.position.y = 0.3;
    generator.add(generatorBody);
    const ventStrip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: "#7ef0c4", toneMapped: false }));
    ventStrip.position.set(0, 0.38, 0.37);
    generator.add(ventStrip);
    generator.position.set(4.3, 0, -1.2);
    camp.add(generator);

    const waterTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.86, 20),
      new THREE.MeshStandardMaterial({ color: "#7d8f92", roughness: 0.5, metalness: 0.42 }),
    );
    waterTank.position.set(-3.9, 0.43, 0.9);
    camp.add(waterTank);

    const lightMasts: THREE.Group[] = [];
    [[-2.3, -2.4], [2.3, -2.4], [-3.0, 2.3], [3.0, 2.3]].forEach(([mastX, mastZ]) => {
      const mast = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.3, 10), new THREE.MeshStandardMaterial({ color: "#3d4a4e", roughness: 0.66, metalness: 0.34 }));
      pole.position.y = 1.15;
      mast.add(pole);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.1, 0.2),
        new THREE.MeshStandardMaterial({ color: "#ffe0a8", emissive: "#ffcf82", emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.1 }),
      );
      head.position.set(0, 2.3, 0.06);
      mast.add(head);
      const headGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.05, 0.22, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: "#ffdfa4", transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
      );
      headGlow.position.set(0, 2.18, 0.1);
      mast.add(headGlow);
      mast.position.set(mastX, 0, mastZ);
      camp.add(mast);
      lightMasts.push(mast);
    });
    surfaceGroup.add(camp);

    const boreLength = well.actualDepth * depthScale;
    const drilledInterval = new THREE.Group();
    const wellbore = new THREE.Mesh(
      new THREE.CylinderGeometry(boreRadius + 0.1, boreRadius + 0.1, boreLength, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: "#101c20", roughness: 0.98, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.035, depthWrite: false }),
    );
    wellbore.position.set(0, -boreLength / 2, wellboreZ);
    drilledInterval.add(wellbore);

    const flowTexture = track(makeFlowTexture());
    flowTexture.wrapS = THREE.RepeatWrapping;
    flowTexture.wrapT = THREE.RepeatWrapping;
    flowTexture.repeat.set(3, 5);
    const annularFluid = new THREE.Mesh(
      new THREE.CylinderGeometry(boreRadius, boreRadius, boreLength, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: "#21b8c8", map: flowTexture, roughness: 0.2, metalness: 0.02, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, emissive: "#0a5962", emissiveIntensity: 0.22 }),
    );
    annularFluid.position.set(0, -boreLength / 2, wellboreZ);
    drilledInterval.add(annularFluid);
    depthSpace.add(drilledInterval);
    drilledIntervalRef.current = drilledInterval;

    const casingGroup = new THREE.Group();
    const casingMaterial = new THREE.MeshStandardMaterial({ color: "#93b6c4", roughness: 0.44, metalness: 0.46, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: "#c9d6d4", roughness: 0.36, metalness: 0.5, emissive: "#2b4a52", emissiveIntensity: 0.22 });
    const casingRuns: { label: string; bottom: number; radius: number }[] = [
      { label: "SURFACE CASING · SCHEMATIC", bottom: 430, radius: 0.33 },
      { label: "INTERMEDIATE CASING · SCHEMATIC", bottom: 806, radius: 0.27 },
    ];
    casingRuns.forEach((run) => {
      const runLength = run.bottom * depthScale;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(run.radius, run.radius, runLength, 20, 1, true), casingMaterial);
      shell.position.set(0, -runLength / 2, wellboreZ);
      casingGroup.add(shell);
      const shoe = new THREE.Mesh(new THREE.CylinderGeometry(run.radius * 1.14, run.radius, 0.07, 20), shoeMaterial);
      shoe.position.set(0, -runLength, wellboreZ);
      casingGroup.add(shoe);
      const ringTicks = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(run.radius, run.radius, runLength, 20, 1, true)),
        new THREE.LineBasicMaterial({ color: "#9fd0de", transparent: true, opacity: 0.34 }),
      );
      ringTicks.position.set(0, -runLength / 2, wellboreZ);
      casingGroup.add(ringTicks);
      const label = makeLabelSprite(run.label, "#9fd0de");
      label.sprite.position.set(-0.95, -runLength + 0.22, wellboreZ + 0.1);
      casingGroup.add(label.sprite);
      track(label.texture);
      track(label.material);
    });
    depthSpace.add(casingGroup);

    const circulation = new THREE.Group();
    const returnFluidMaterial = new THREE.MeshBasicMaterial({ color: "#54f1de", toneMapped: false });
    const downStringFluidMaterial = new THREE.MeshBasicMaterial({ color: "#65aaff", toneMapped: false });
    const circulationParticles: THREE.Mesh[] = [];
    for (let particle = 0; particle < 40; particle += 1) {
      const isReturnFlow = particle < 20;
      const slot = particle % 20;
      const bead = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.2, 7), isReturnFlow ? returnFluidMaterial : downStringFluidMaterial);
      const angle = (slot / 20) * Math.PI * 2;
      bead.position.set(
        isReturnFlow ? Math.cos(angle) * 0.345 : Math.cos(angle) * 0.05,
        0,
        wellboreZ + (isReturnFlow ? Math.sin(angle) * 0.345 : Math.sin(angle) * 0.05),
      );
      bead.rotation.x = isReturnFlow ? 0 : Math.PI;
      bead.userData.flowDirection = isReturnFlow ? "up" : "down";
      bead.userData.phaseOffset = (slot / 20) * 0.9;
      bead.userData.baseAngle = angle;
      circulation.add(bead);
      circulationParticles.push(bead);
    }
    const bitWash = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#4debd5", transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    circulation.add(bitWash);
    depthSpace.add(circulation);
    circulationParticlesRef.current = circulationParticles;

    const cuttingsMaterial = new THREE.MeshBasicMaterial({ color: "#c8a978", toneMapped: false, transparent: true, opacity: 0.85 });
    const cuttings: THREE.Mesh[] = [];
    const cuttingsRandom = createRandom(913);
    for (let chip = 0; chip < 26; chip += 1) {
      const chipMesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.028 + cuttingsRandom() * 0.022), cuttingsMaterial);
      const angle = cuttingsRandom() * Math.PI * 2;
      chipMesh.userData.baseAngle = angle;
      chipMesh.userData.phaseOffset = cuttingsRandom();
      chipMesh.userData.radius = 0.1 + cuttingsRandom() * 0.16;
      chipMesh.position.set(Math.cos(angle) * 0.28, 0, wellboreZ + Math.sin(angle) * 0.28);
      circulation.add(chipMesh);
      cuttings.push(chipMesh);
    }

    const pipeTexture = track(makePipeTexture());
    pipeTexture.wrapS = THREE.RepeatWrapping;
    pipeTexture.wrapT = THREE.RepeatWrapping;
    pipeTexture.repeat.set(1, 1);
    const pipeSteel = new THREE.MeshStandardMaterial({ color: "#eef3f0", map: pipeTexture, emissive: "#7d9694", emissiveIntensity: 0.3, roughness: 0.34, metalness: 0.32, side: THREE.DoubleSide });
    const pipeBoreMaterial = new THREE.MeshBasicMaterial({ color: "#17496b", transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const jointMaterial = new THREE.MeshStandardMaterial({ color: "#d5e1df", map: pipeTexture, emissive: "#647f83", emissiveIntensity: 0.34, roughness: 0.28, metalness: 0.36 });

    const drillstring = new THREE.Group();
    const standLength = standLengthMeters * depthScale;
    const standPipeGeometry = new THREE.CylinderGeometry(pipeRadius, pipeRadius, standLength, 20, 1, true);
    const standBoreGeometry = new THREE.CylinderGeometry(0.105, 0.105, standLength, 14, 1, true);
    const toolJointGeometry = new THREE.CylinderGeometry(0.215, 0.215, 0.11, 20);
    const shoulderGeometry = new THREE.CylinderGeometry(0.198, 0.198, 0.028, 20);
    const railGeometry = new THREE.CylinderGeometry(0.015, 0.015, standLength * 0.9, 6);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: "#f2fffc", toneMapped: false });

    const buildStand = () => {
      const section = new THREE.Group();
      const outerPipe = new THREE.Mesh(standPipeGeometry, pipeSteel);
      const innerPipeWall = new THREE.Mesh(standBoreGeometry, pipeBoreMaterial);
      innerPipeWall.position.z = 0.004;
      section.add(outerPipe, innerPipeWall);

      const upperToolJoint = new THREE.Mesh(toolJointGeometry, jointMaterial);
      upperToolJoint.position.y = standLength / 2 - 0.03;
      section.add(upperToolJoint);
      const upperShoulder = new THREE.Mesh(shoulderGeometry, jointMaterial);
      upperShoulder.position.y = standLength / 2 - 0.105;
      section.add(upperShoulder);

      const lowerToolJoint = new THREE.Mesh(toolJointGeometry, jointMaterial);
      lowerToolJoint.position.y = -standLength / 2 + 0.03;
      lowerToolJoint.userData.role = "lower-joint";
      section.add(lowerToolJoint);
      const lowerShoulder = new THREE.Mesh(shoulderGeometry, jointMaterial);
      lowerShoulder.position.y = -standLength / 2 + 0.105;
      section.add(lowerShoulder);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(railGeometry, highlightMaterial);
        rail.position.set(side * 0.105, 0, 0.108);
        section.add(rail);
      }

      section.userData.nominalLength = standLengthMeters;
      return section;
    };

    const bhaLengthMeters = Math.min(72, Math.max(36, well.actualDepth * 0.09));
    const bhaLength = bhaLengthMeters * depthScale;
    const standCount = Math.ceil(well.actualDepth / standLengthMeters);
    for (let standIndex = 0; standIndex < standCount; standIndex += 1) {
      const section = buildStand();
      section.userData.startDepth = standIndex * standLengthMeters;
      section.position.set(0, -(standIndex * standLengthMeters + standLengthMeters / 2) * depthScale, 0);
      drillstring.add(section);
    }

    const handledStand = buildStand();
    handledStand.position.set(0, 0, wellboreZ);
    handledStand.visible = false;
    surfaceGroup.add(handledStand);

    const bha = new THREE.Group();
    const collarMaterial = new THREE.MeshStandardMaterial({ color: "#c6d0cc", map: pipeTexture, emissive: "#637a78", emissiveIntensity: 0.3, roughness: 0.34, metalness: 0.38 });
    const connectionJoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.222, 0.222, bhaLength * 0.09, 22),
      new THREE.MeshStandardMaterial({ color: "#e3ece9", map: pipeTexture, emissive: "#7f9a99", emissiveIntensity: 0.34, roughness: 0.3, metalness: 0.4 }),
    );
    connectionJoint.position.y = bhaLength * 0.455;
    bha.add(connectionJoint);
    const upperCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, bhaLength * 0.22, 22), collarMaterial);
    upperCollar.position.y = bhaLength * 0.32;
    bha.add(upperCollar);
    const lowerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, bhaLength * 0.18, 22), collarMaterial);
    lowerCollar.position.y = -bhaLength * 0.02;
    bha.add(lowerCollar);

    const reamer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.235, bhaLength * 0.1, 20),
      new THREE.MeshStandardMaterial({ color: "#efb54e", map: pipeTexture, emissive: "#6b4012", emissiveIntensity: 0.24, roughness: 0.32, metalness: 0.4 }),
    );
    reamer.position.y = -bhaLength * 0.16;
    bha.add(reamer);

    const mwdHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, bhaLength * 0.14, 18),
      new THREE.MeshStandardMaterial({ color: "#2f3f4a", roughness: 0.42, metalness: 0.55, emissive: "#12303a", emissiveIntensity: 0.5 }),
    );
    mwdHousing.position.y = bhaLength * 0.14;
    bha.add(mwdHousing);
    const mwdAntenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, bhaLength * 0.2, 8),
      new THREE.MeshStandardMaterial({ color: "#c9d6d4", roughness: 0.3, metalness: 0.6, emissive: "#3f6f7a", emissiveIntensity: 0.3 }),
    );
    mwdAntenna.position.set(0.19, bhaLength * 0.21, 0);
    bha.add(mwdAntenna);

    const motorHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, bhaLength * 0.16, 20),
      new THREE.MeshStandardMaterial({ color: "#b5c8c3", map: pipeTexture, emissive: "#496766", emissiveIntensity: 0.26, roughness: 0.3, metalness: 0.4 }),
    );
    motorHousing.position.y = -bhaLength * 0.3;
    bha.add(motorHousing);
    const motorRotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, bhaLength * 0.07, 20),
      new THREE.MeshStandardMaterial({ color: "#e2a54c", emissive: "#7a4a12", emissiveIntensity: 0.55, roughness: 0.34, metalness: 0.3 }),
    );
    motorRotor.position.y = -bhaLength * 0.3;
    bha.add(motorRotor);
    bha.userData.rotor = motorRotor;

    for (let stabilizerIndex = 0; stabilizerIndex < 3; stabilizerIndex += 1) {
      const stabilizer = new THREE.Mesh(
        new THREE.TorusGeometry(0.255, 0.032, 8, 22),
        new THREE.MeshStandardMaterial({ color: "#efb54e", emissive: "#6b4012", emissiveIntensity: 0.26, roughness: 0.3, metalness: 0.38 }),
      );
      stabilizer.rotation.x = Math.PI / 2;
      stabilizer.position.y = (0.28 - stabilizerIndex * 0.24) * bhaLength;
      bha.add(stabilizer);
      for (let bladeIndex = 0; bladeIndex < 3; bladeIndex += 1) {
        const bladeAngle = (bladeIndex / 3) * Math.PI * 2 + stabilizerIndex;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, bhaLength * 0.1, 0.07),
          new THREE.MeshStandardMaterial({ color: "#dfe5e0", roughness: 0.28, metalness: 0.62 }),
        );
        blade.position.set(Math.cos(bladeAngle) * 0.27, stabilizer.position.y, Math.sin(bladeAngle) * 0.27);
        blade.rotation.y = -bladeAngle;
        bha.add(blade);
      }
    }

    const bitSub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.205, bhaLength * 0.12, 18),
      new THREE.MeshStandardMaterial({ color: "#c9d6d4", roughness: 0.3, metalness: 0.6, emissive: "#2a4a52", emissiveIntensity: 0.24 }),
    );
    bitSub.position.y = -bhaLength * 0.44;
    bha.add(bitSub);
    bha.userData.isBha = true;
    bha.position.set(0, -(well.actualDepth - bhaLengthMeters / 2) * depthScale, 0);
    drillstring.add(bha);
    drillstring.position.z = wellboreZ;
    depthSpace.add(drillstring);
    drillstringRef.current = drillstring;

    const wellhead = new THREE.Group();
    const wellheadBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.16, 24), new THREE.MeshStandardMaterial({ color: "#bec9c4", metalness: 0.72, roughness: 0.28 }));
    wellheadBase.position.y = 0.11;
    wellhead.add(wellheadBase);
    const wellheadStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.35, 20), new THREE.MeshStandardMaterial({ color: "#e2ad58", metalness: 0.58, roughness: 0.34 }));
    wellheadStem.position.y = 0.34;
    wellhead.add(wellheadStem);
    const wellheadFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.05, 22),
      new THREE.MeshStandardMaterial({ color: "#a8b5b0", metalness: 0.66, roughness: 0.32 }),
    );
    wellheadFlange.position.y = 0.52;
    wellhead.add(wellheadFlange);
    const sideOutlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.34, 14),
      new THREE.MeshStandardMaterial({ color: "#d8b06a", metalness: 0.6, roughness: 0.32 }),
    );
    sideOutlet.rotation.z = Math.PI / 2;
    sideOutlet.position.set(0.22, 0.42, 0);
    wellhead.add(sideOutlet);
    const valveBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: "#c25a44", metalness: 0.5, roughness: 0.42 }),
    );
    valveBody.position.set(0.38, 0.42, 0);
    wellhead.add(valveBody);
    const handWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.016, 6, 18),
      new THREE.MeshStandardMaterial({ color: "#e0523c", emissive: "#5a1a10", emissiveIntensity: 0.3, metalness: 0.44, roughness: 0.4 }),
    );
    handWheel.rotation.x = Math.PI / 2;
    handWheel.position.set(0.38, 0.52, 0);
    wellhead.add(handWheel);
    for (let spoke = 0; spoke < 3; spoke += 1) {
      const spokeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: "#e0523c", metalness: 0.44, roughness: 0.4 }));
      spokeMesh.position.set(0.38, 0.52, 0);
      spokeMesh.rotation.y = (spoke / 3) * Math.PI;
      wellhead.add(spokeMesh);
    }
    const gaugeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: "#d8e2dd", metalness: 0.5, roughness: 0.3, emissive: "#20404a", emissiveIntensity: 0.4 }),
    );
    gaugeBody.rotation.x = Math.PI / 2;
    gaugeBody.position.set(0, 0.62, 0.13);
    wellhead.add(gaugeBody);
    wellhead.position.z = wellboreZ;
    surfaceGroup.add(wellhead);

    const rigStructure = new THREE.Group();
    const rigSteel = new THREE.LineBasicMaterial({ color: "#d8e1dd", transparent: true, opacity: 0.8 });
    const rigPoints = [
      new THREE.Vector3(-0.8, 0.58, -0.72), new THREE.Vector3(0.8, 0.58, -0.72),
      new THREE.Vector3(0.8, 0.58, 0.72), new THREE.Vector3(-0.8, 0.58, 0.72),
      new THREE.Vector3(-0.42, 3.05, -0.38), new THREE.Vector3(0.42, 3.05, -0.38),
      new THREE.Vector3(0.42, 3.05, 0.38), new THREE.Vector3(-0.42, 3.05, 0.38),
    ];
    const rigEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7], [0, 5], [1, 4], [2, 7], [3, 6]];
    for (const [from, to] of rigEdges) {
      rigStructure.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([rigPoints[from], rigPoints[to]]), rigSteel));
    }
    const bracingMaterial = new THREE.LineBasicMaterial({ color: "#9fb4ad", transparent: true, opacity: 0.42 });
    for (const side of [-1, 1]) {
      for (let bandIndex = 0; bandIndex < 3; bandIndex += 1) {
        const yLow = 0.62 + bandIndex * 0.82;
        const yHigh = yLow + 0.82;
        const halfAt = (y: number) => 0.8 - (y - 0.58) * 0.152;
        const zAt = (y: number) => 0.72 - (y - 0.58) * 0.137;
        const braceA = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(side * halfAt(yLow), yLow, -zAt(yLow)),
            new THREE.Vector3(side * halfAt(yHigh), yHigh, -zAt(yHigh)),
          ]),
          bracingMaterial,
        );
        const braceB = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(side * halfAt(yLow), yLow, -zAt(yLow)),
            new THREE.Vector3(side * halfAt(yHigh), yHigh, zAt(yHigh)),
          ]),
          bracingMaterial,
        );
        const braceC = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(side * halfAt(yLow), yLow, zAt(yLow)),
            new THREE.Vector3(side * halfAt(yHigh), yHigh, -zAt(yHigh)),
          ]),
          bracingMaterial,
        );
        rigStructure.add(braceA, braceB, braceC);
      }
    }
    const crownBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.13, 0.6),
      new THREE.MeshStandardMaterial({ color: "#d9a64f", roughness: 0.36, metalness: 0.62 }),
    );
    crownBlock.position.y = 2.93;
    rigStructure.add(crownBlock);
    for (const sheaveX of [-0.22, 0, 0.22]) {
      const sheave = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.035, 8, 18),
        new THREE.MeshStandardMaterial({ color: "#b9c6c1", metalness: 0.72, roughness: 0.26 }),
      );
      sheave.rotation.y = Math.PI / 2;
      sheave.position.set(sheaveX, 3.04, 0);
      rigStructure.add(sheave);
    }
    const drawworks = new THREE.Group();
    const drawworksBody = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: "#4a5b5c", roughness: 0.6, metalness: 0.42 }));
    drawworks.add(drawworksBody);
    const drawworksDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16),
      new THREE.MeshStandardMaterial({ color: "#c2ccc8", metalness: 0.7, roughness: 0.3, emissive: "#3d5150", emissiveIntensity: 0.24 }),
    );
    drawworksDrum.rotation.x = Math.PI / 2;
    drawworksDrum.position.set(0, 0.02, 0.24);
    drawworks.add(drawworksDrum);
    drawworks.position.set(0, 3.32, 0);
    drawworks.userData.drum = drawworksDrum;
    rigStructure.add(drawworks);
    const travelingBlock = new THREE.Group();
    const blockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.4, 0.52),
      new THREE.MeshStandardMaterial({ color: "#d6dedb", emissive: "#435b5a", emissiveIntensity: 0.24, roughness: 0.3, metalness: 0.48 }),
    );
    travelingBlock.add(blockBody);
    for (const sheaveX of [-0.2, 0.2]) {
      const blockSheave = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.03, 8, 16),
        new THREE.MeshStandardMaterial({ color: "#c2ccc8", metalness: 0.7, roughness: 0.28 }),
      );
      blockSheave.rotation.y = Math.PI / 2;
      blockSheave.position.set(sheaveX, 0.06, 0);
      travelingBlock.add(blockSheave);
    }
    const topDriveHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.34, 0.42),
      new THREE.MeshStandardMaterial({ color: "#e2aa4d", emissive: "#654014", emissiveIntensity: 0.22, roughness: 0.34, metalness: 0.4 }),
    );
    topDriveHousing.position.y = -0.37;
    travelingBlock.add(topDriveHousing);
    const topDriveMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: "#3c4c50", metalness: 0.6, roughness: 0.34, emissive: "#16333a", emissiveIntensity: 0.4 }),
    );
    topDriveMotor.position.set(0, -0.2, 0);
    travelingBlock.add(topDriveMotor);
    const kellyStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.42, 14),
      new THREE.MeshStandardMaterial({ color: "#cbd5d1", metalness: 0.66, roughness: 0.28 }),
    );
    kellyStem.position.y = -0.62;
    travelingBlock.add(kellyStem);
    const driveShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.55, 16),
      new THREE.MeshStandardMaterial({ color: "#cdd8d4", roughness: 0.28, metalness: 0.38 }),
    );
    driveShaft.position.y = -0.77;
    travelingBlock.add(driveShaft);
    rigStructure.add(travelingBlock);
    rigStructure.userData.travelingBlock = travelingBlock;
    const crownCableMaterial = new THREE.LineBasicMaterial({ color: "#c7d2ce", transparent: true, opacity: 0.8 });
    for (const x of [-0.24, 0.24]) {
      const cable = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 2.87, 0), new THREE.Vector3(x, 1.42, 0)]),
        crownCableMaterial,
      );
      rigStructure.add(cable);
    }
    const rigFloor = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.12, 1.8),
      new THREE.MeshStandardMaterial({ color: "#73827d", roughness: 0.62, metalness: 0.48 }),
    );
    rigFloor.position.y = 0.55;
    rigStructure.add(rigFloor);
    const grateTexture = track(makeGrateTexture());
    grateTexture.wrapS = THREE.RepeatWrapping;
    grateTexture.wrapT = THREE.RepeatWrapping;
    grateTexture.repeat.set(4, 4);
    const rigFloorDeck = new THREE.Mesh(
      new THREE.BoxGeometry(2.06, 0.02, 1.76),
      new THREE.MeshStandardMaterial({ color: "#ffffff", map: grateTexture, roughness: 0.68, metalness: 0.36 }),
    );
    rigFloorDeck.position.y = 0.615;
    rigStructure.add(rigFloorDeck);
    const railMaterial = new THREE.LineBasicMaterial({ color: "#b6c6c1", transparent: true, opacity: 0.6 });
    for (const railY of [0.78, 1.02]) {
      for (const railZ of [-0.86, 0.86]) {
        const handRail = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.0, railY, railZ), new THREE.Vector3(1.0, railY, railZ)]),
          railMaterial,
        );
        rigStructure.add(handRail);
      }
    }
    for (const postX of [-1.0, -0.5, 0, 0.5, 1.0]) {
      for (const postZ of [-0.86, 0.86]) {
        const post = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(postX, 0.61, postZ), new THREE.Vector3(postX, 1.02, postZ)]),
          railMaterial,
        );
        rigStructure.add(post);
      }
    }
    const rotaryTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: "#7d8b86", metalness: 0.6, roughness: 0.34 }),
    );
    rotaryTable.position.y = 0.64;
    rigStructure.add(rotaryTable);
    const rigLegMaterial = new THREE.MeshStandardMaterial({ color: "#5b6a66", roughness: 0.7, metalness: 0.3 });
    for (const legX of [-0.85, 0.85]) {
      for (const legZ of [-0.72, 0.72]) {
        const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8), rigLegMaterial);
        legMesh.position.set(legX, 0.26, legZ);
        rigStructure.add(legMesh);
      }
    }

    const mudPump = new THREE.Group();
    const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: "#8a5a2c", roughness: 0.56, metalness: 0.38 }));
    pumpBody.position.y = 0.3;
    mudPump.add(pumpBody);
    const pumpPlungers: THREE.Mesh[] = [];
    for (let plunger = 0; plunger < 3; plunger += 1) {
      const plungerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10),
        new THREE.MeshStandardMaterial({ color: "#d7dee0", metalness: 0.68, roughness: 0.24, emissive: "#3a4c50", emissiveIntensity: 0.3 }),
      );
      plungerMesh.rotation.z = Math.PI / 2;
      plungerMesh.position.set(-0.42, 0.3, -0.2 + plunger * 0.2);
      mudPump.add(plungerMesh);
      pumpPlungers.push(plungerMesh);
    }
    const pumpBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.7), rigLegMaterial);
    pumpBase.position.y = 0.03;
    mudPump.add(pumpBase);
    mudPump.position.set(-3.4, 0, -2.9);
    surfaceGroup.add(mudPump);

    rigStructure.position.z = wellboreZ;
    surfaceGroup.add(rigStructure);
    scene.add(surfaceGroup);

    const depthMarker = new THREE.Group();
    const bitBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.155, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: "#d5d9ce", metalness: 0.72, roughness: 0.26 }),
    );
    const bitAssembly = new THREE.Group();
    const cutterMaterial = new THREE.MeshStandardMaterial({ color: "#d7a854", emissive: "#604116", emissiveIntensity: 0.16, metalness: 0.64, roughness: 0.3 });
    for (let cutter = 0; cutter < 3; cutter += 1) {
      const angle = (cutter / 3) * Math.PI * 2;
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.065, 0.17, 12), cutterMaterial);
      roller.position.set(Math.cos(angle) * 0.075, -0.13, Math.sin(angle) * 0.075);
      roller.rotation.z = Math.cos(angle) * 0.34;
      roller.rotation.x = Math.sin(angle) * 0.34;
      bitAssembly.add(roller);
      const cutterBand = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.012, 6, 14), new THREE.MeshStandardMaterial({ color: "#dfe5e0", metalness: 0.82, roughness: 0.24 }));
      cutterBand.rotation.x = Math.PI / 2;
      cutterBand.position.copy(roller.position);
      bitAssembly.add(cutterBand);
      const rollerTeeth = new THREE.Mesh(
        new THREE.ConeGeometry(0.024, 0.05, 6),
        new THREE.MeshStandardMaterial({ color: "#f0f4f0", metalness: 0.86, roughness: 0.18 }),
      );
      rollerTeeth.position.set(Math.cos(angle) * 0.09, -0.21, Math.sin(angle) * 0.09);
      rollerTeeth.rotation.x = Math.PI;
      bitAssembly.add(rollerTeeth);
    }
    const bitCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.15, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: "#8d968c", metalness: 0.7, roughness: 0.3, emissive: "#2b332a", emissiveIntensity: 0.2 }),
    );
    bitCrown.position.y = -0.02;
    bitAssembly.add(bitCrown);
    for (let nozzle = 0; nozzle < 6; nozzle += 1) {
      const nozzleAngle = (nozzle / 6) * Math.PI * 2;
      const jetNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.011, 0.04, 8),
        new THREE.MeshStandardMaterial({ color: "#4e7c83", metalness: 0.68, roughness: 0.25, emissive: "#1b3a3e", emissiveIntensity: 0.4 }),
      );
      jetNozzle.position.set(Math.cos(nozzleAngle) * 0.12, -0.2, Math.sin(nozzleAngle) * 0.12);
      jetNozzle.rotation.x = Math.PI;
      bitAssembly.add(jetNozzle);
    }
    const bitNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.1, 12), new THREE.MeshStandardMaterial({ color: "#4e7c83", metalness: 0.68, roughness: 0.25 }));
    bitNozzle.position.y = -0.2;
    bitAssembly.add(bitNozzle);
    const bitGroup = new THREE.Group();
    bitGroup.add(bitBody, bitAssembly);
    bitGroup.position.y = -bitDrop;
    depthMarker.add(bitGroup);
    depthMarker.position.set(0, -initialDepthRef.current * depthScale, wellboreZ);
    depthSpace.add(depthMarker);
    markerRef.current = depthMarker;
    bitRef.current = depthMarker;
    bitGlow.position.set(0, -initialDepthRef.current * depthScale - bitDrop, wellboreZ + 0.16);

    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.018, 8, 32),
      new THREE.MeshBasicMaterial({ color: "#75f2e1", transparent: true, opacity: 0.86 }),
    );
    pulse.rotation.x = Math.PI / 2;
    pulse.position.y = -0.14;
    depthMarker.add(pulse);

    const eventsGroup = new THREE.Group();
    const eventMarkerRefs: { mesh: THREE.Mesh; event: EventRecord }[] = [];
    referenceEvents.forEach((event, index) => {
      const color = event.severity === "Critical" ? "#ff6267" : event.type === "Mud Loss" ? "#ffac55" : "#f4d36b";
      const eventMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.145, 16, 12),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      eventMarker.userData.eventRecord = event;
      eventMarker.position.set(index % 2 === 0 ? -0.52 : 0.52, -event.depth * depthScale, 1.9);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.012, 6, 26),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, toneMapped: false }),
      );
      halo.rotation.x = Math.PI / 2;
      eventMarker.add(halo);
      const guide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(index % 2 === 0 ? -0.52 : 0.52, 0, 1.9), new THREE.Vector3(index % 2 === 0 ? -0.52 : 0.52, -event.depth * depthScale, 1.9)]),
        new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.35, dashSize: 0.06, gapSize: 0.06 }),
      );
      guide.computeLineDistances();
      eventsGroup.add(guide);
      const label = makeLabelSprite(`${event.type.toUpperCase()} · ${event.depth} m`, color);
      label.sprite.position.set(index % 2 === 0 ? -1.28 : 1.28, -event.depth * depthScale, 1.9);
      eventsGroup.add(label.sprite);
      track(label.texture);
      track(label.material);
      eventsGroup.add(eventMarker);
      eventMarkerRefs.push({ mesh: eventMarker, event });
    });
    depthSpace.add(eventsGroup);
    eventRefs.current = eventMarkerRefs;

    const depthAxis = new THREE.Group();
    const axisMaterial = new THREE.LineBasicMaterial({ color: "#d0e0dc", transparent: true, opacity: 0.45 });
    const axisPoints = [new THREE.Vector3(-3.7, 0, 0), new THREE.Vector3(-3.7, -boreLength, 0)];
    depthAxis.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(axisPoints), axisMaterial));
    [0, 200, 400, 600, 800, 1000, 1200].forEach((value) => {
      const y = -value * depthScale;
      depthAxis.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.82, y, 0), new THREE.Vector3(-3.52, y, 0)]),
        axisMaterial,
      ));
      if (value * depthScale <= boreLength + 0.001) {
        const label = makeLabelSprite(`${value} m`, "#cfe6e0");
        label.sprite.position.set(-4.24, y, 0);
        depthAxis.add(label.sprite);
        track(label.texture);
        track(label.material);
      }
    });
    depthSpace.add(depthAxis);
    scene.add(depthSpace);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 9;
    controls.target.set(0, -4.6, 0);
    controls.maxDistance = 60;
    controls.update();
    controlsRef.current = controls;

    const resizeObserver = new ResizeObserver(() => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);

    const drawworksDrumHandle = drawworks.userData.drum as THREE.Mesh;
    const motorRotorHandle = bha.userData.rotor as THREE.Mesh;
    const lightMastHeads = lightMasts.map((mast) => mast.children[1] as THREE.Mesh);

    let stringSpin = 0;
    let tripDirection = -1;
    let lastHandledIndex = Math.floor(cursorDepthRef.current / standLengthMeters);
    let rakingStart: number | null = null;
    let lastDriveAt = performance.now();

    const animationStartedAt = performance.now();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const elapsed = (now - animationStartedAt) / 1000;
      const mode = operationRef.current;
      const sceneDriving = mode !== "hold" && !playingRef.current;
      const isDrilling = playingRef.current || mode === "drill" || mode === "trip";

      if (sceneDriving) {
        const stepMs = mode === "trip" ? 900 : 260;
        if (now - lastDriveAt >= stepMs) {
          lastDriveAt = now;
          if (mode === "drill") {
            onDepthChangeRef.current?.(Math.min(well.actualDepth, cursorDepthRef.current + 9));
          } else {
            const next = cursorDepthRef.current + tripDirection * standLengthMeters;
            if (tripDirection < 0 && next <= standLengthMeters) {
              tripDirection = 1;
              onDepthChangeRef.current?.(Math.min(well.actualDepth, cursorDepthRef.current + standLengthMeters));
            } else if (tripDirection > 0 && next >= well.actualDepth - standLengthMeters) {
              tripDirection = -1;
              onDepthChangeRef.current?.(Math.max(0, cursorDepthRef.current - standLengthMeters));
            } else {
              onDepthChangeRef.current?.(Math.max(0, Math.min(well.actualDepth, next)));
            }
          }
        }
      }

      const activeDepth = cursorDepthRef.current;
      const handledIndex = Math.floor(activeDepth / standLengthMeters);
      if (isDrilling && handledIndex !== lastHandledIndex) {
        lastHandledIndex = handledIndex;
        rakingStart = now;
        handledStand.visible = true;
      } else if (!isDrilling) {
        lastHandledIndex = handledIndex;
      }
      if (rakingStart !== null) {
        const progress = (now - rakingStart) / 1150;
        if (progress >= 1) {
          rakingStart = null;
          handledStand.visible = false;
        } else {
          const eased = progress * progress * (3 - 2 * progress);
          handledStand.rotation.z = -eased * 1.4;
          handledStand.position.x = -eased * 3.1;
          handledStand.position.y = eased * 0.62;
          handledStand.position.z = wellboreZ - eased * 2.4;
          handledStand.scale.setScalar(1 - eased * 0.12);
        }
      }

      pulse.scale.setScalar(0.88 + (Math.sin(elapsed * 3.8) + 1) * 0.18);
      (pulse.material as THREE.MeshBasicMaterial).opacity = 0.48 + (Math.sin(elapsed * 3.8) + 1) * 0.18;
      depthSpace.scale.y = exaggerationRef.current;
      stratigraphyRef.visible = layerRefs.current.formations;
      surfaceGroup.visible = layerRefs.current.surface;
      drillstring.visible = layerRefs.current.drillstring;
      casingGroup.visible = layerRefs.current.drillstring;
      if (drillstring.visible && isDrilling) {
        stringSpin += 0.035;
        drawworksDrumHandle.rotation.y += 0.18;
        motorRotorHandle.rotation.y -= 0.16;
        pumpPlungers.forEach((plunger, index) => {
          plunger.position.x = -0.42 + Math.sin(elapsed * 3.1 + index * 0.5) * 0.055;
        });
      }
      drillstring.rotation.y = stringSpin;
      const travelingBlock = rigStructure.userData.travelingBlock as THREE.Group;
      travelingBlock.position.y = 1.45 - (activeDepth / Math.max(well.actualDepth, 1)) * 0.85;
      annularFluid.visible = layerRefs.current.drillstring;
      wellbore.visible = layerRefs.current.drillstring;
      eventsGroup.visible = layerRefs.current.events;
      circulation.visible = isDrilling && layerRefs.current.drillstring && activeDepth > 0;
      if (isDrilling) flowTexture.offset.y = (flowTexture.offset.y - 0.014 + 1) % 1;
      tankTexture.offset.x = Math.sin(elapsed * 0.35) * 0.05;
      bitGlow.intensity = isDrilling ? 1.5 + (Math.sin(elapsed * 5.2) + 1) * 0.5 : 0.15;
      bitGlow.position.y = -activeDepth * depthScale - bitDrop;
      wellheadGlow.intensity = 1 + Math.sin(elapsed * 1.6) * 0.12;
      floodLights.forEach((flood, index) => {
        flood.intensity = 2.1 + Math.sin(elapsed * (2.4 + index) + index) * 0.09;
      });
      lightMastHeads.forEach((head, index) => {
        const material = head.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 1.4 + Math.sin(elapsed * (3 + index * 0.7)) * 0.16;
      });
      circulationParticles.forEach((particle, index) => {
        const phase = (elapsed * 0.32 + particle.userData.phaseOffset) % 1;
        const depthPosition = particle.userData.flowDirection === "up" ? 1 - phase : phase;
        particle.position.y = -activeDepth * depthScale * depthPosition;
        const swirl = elapsed * 0.6 + particle.userData.baseAngle;
        particle.position.x = Math.cos(swirl) * (particle.userData.flowDirection === "up" ? 0.345 : 0.05);
        particle.position.z = wellboreZ + Math.sin(swirl) * (particle.userData.flowDirection === "up" ? 0.345 : 0.05);
        particle.rotation.y += 0.12;
        if (index % 2 === 0) particle.rotation.z += 0.05;
      });
      cuttings.forEach((chip) => {
        const phase = (elapsed * 0.5 + chip.userData.phaseOffset) % 1;
        chip.position.y = -0.3 + phase * Math.min(activeDepth * depthScale, 0.9);
        const swirl = elapsed * 1.4 + chip.userData.baseAngle;
        const radius = chip.userData.radius * (1 - phase * 0.35);
        chip.position.x = Math.cos(swirl) * radius;
        chip.position.z = wellboreZ + Math.sin(swirl) * radius;
        chip.rotation.x += 0.14;
        chip.rotation.z += 0.09;
      });
      if (isDrilling && bitRef.current) {
        bitRef.current.rotation.y = stringSpin;
        bitRef.current.rotation.x = Math.sin(elapsed * 2.4) * 0.05;
        bitRef.current.rotation.z = Math.cos(elapsed * 1.9) * 0.05;
        bitRef.current.position.x = Math.sin(elapsed * 3.1) * 0.012;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      disposables.forEach((item) => item.dispose());
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Line || object instanceof THREE.GridHelper) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      markerRef.current = null;
      drillstringRef.current = null;
      drilledIntervalRef.current = null;
      bitRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      eventRefs.current = [];
      circulationParticlesRef.current = [];
    };
  }, [well.actualDepth]);

  useEffect(() => {
    const activeDepth = Math.max(0, Math.min(depth, well.actualDepth));
    cursorDepthRef.current = activeDepth;
    if (markerRef.current) markerRef.current.position.y = -activeDepth * depthScale;
    if (bitRef.current) bitRef.current.position.y = -activeDepth * depthScale;
    const bhaLengthMeters = Math.min(72, Math.max(36, well.actualDepth * 0.09));
    const bhaTopDepth = Math.max(0, activeDepth - bhaLengthMeters);
    if (drillstringRef.current) {
      for (const section of drillstringRef.current.children) {
        if (!(section instanceof THREE.Group) || typeof section.userData.startDepth !== "number") continue;
        const startDepth = section.userData.startDepth as number;
        const nominalLength = section.userData.nominalLength as number;
        const sectionLength = Math.max(0, Math.min(nominalLength, bhaTopDepth - startDepth));
        // eslint-disable-next-line react-hooks/immutability
        section.visible = sectionLength > 0;
        if (sectionLength > 0) {
          section.scale.y = sectionLength / nominalLength;
          section.position.y = -(startDepth + sectionLength / 2) * depthScale;
          const lowerJoint = section.children.find((child) => child instanceof THREE.Mesh && child.userData.role === "lower-joint");
          if (lowerJoint) {
            lowerJoint.visible = sectionLength >= nominalLength - 0.25;
          }
        }
      }
      const bha = drillstringRef.current.children.find((child) => child instanceof THREE.Group && child.userData.isBha);
      if (bha) {
        bha.visible = activeDepth > 0;
        bha.position.y = -(bhaTopDepth + bhaLengthMeters / 2) * depthScale;
      }
    }
    if (drilledIntervalRef.current) {
      drilledIntervalRef.current.scale.y = Math.max(activeDepth / well.actualDepth, 0.001);
    }
    const activeIndex = formationIntervals.findIndex((interval) => activeDepth >= interval.top && activeDepth < interval.bottom);
    bandMaterialsRef.current.forEach((material, index) => {
      const isActive = index === activeIndex;
      material.emissive.set(isActive ? "#33402f" : "#000000");
      material.emissiveIntensity = isActive ? 0.55 : 0;
    });
    bandEdgesRef.current.forEach((edges, index) => {
      edges.forEach((edge) => {
        const material = edge.material as THREE.LineBasicMaterial;
        material.opacity = index === activeIndex ? 1 : 0.62;
      });
    });
    eventRefs.current.forEach(({ mesh, event }) => {
      const nearCursor = Math.abs(event.depth - depth) <= 24;
      mesh.scale.setScalar(nearCursor ? 1.45 : 1);
    });
  }, [depth, well.actualDepth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(pointer, camera);
      const match = raycaster.intersectObjects(eventRefs.current.map(({ mesh }) => mesh), false)[0];
      if (match?.object.userData.eventRecord) onEventSelectRef.current(match.object.userData.eventRecord as EventRecord);
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const zoomFactor = 1 + (verticalExaggeration - 1) * 0.42;
    cameraRef.current.position.set(12 * zoomFactor, 7.2 * zoomFactor, 15 * zoomFactor);
    controlsRef.current.target.set(0, -4.6 * verticalExaggeration, 0);
    controlsRef.current.update();
  }, [verticalExaggeration]);

  const referenceFormation = formationAtReferenceDepth(depth);

  return (
    <div className="relative h-full min-h-[330px] w-full overflow-hidden bg-[#101e25]">
      <canvas
        ref={canvasRef}
        aria-label={`Interactive schematic subsurface scene for ${well.id}, showing WX-07 reference formation intervals`}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />
      {!webglAvailable && (
        <div role="status" className="absolute inset-0 grid place-items-center bg-[#101e25] px-6 text-center text-sm text-ink-3">
          This browser does not support WebGL. Use the depth section view to inspect the reference formation intervals.
        </div>
      )}

      {/* Schematic panel (left) */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[270px] rounded-[6px] border border-line bg-surface text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between gap-2 p-2.5">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            title={panelOpen ? "Collapse details" : "Expand schematic details"}
            className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${panelOpen ? "rotate-90" : ""}`} />
            <span className="truncate">Subsurface schematic</span>
          </button>
          <span className="shrink-0 rounded-[4px] bg-surface-muted border border-line px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-2">
            {Math.round(depth).toLocaleString("en-IN")} m
          </span>
        </div>

        {panelOpen && (
          <div className="border-t border-line px-3 pb-3 pt-2 space-y-2 pointer-events-auto">
            <div className="text-xs font-semibold text-ink">{well.id} · Vertical wellbore</div>
            <div className="flex items-center gap-1 text-xs text-ink-2">
              <Waves className="h-3.5 w-3.5 text-accent shrink-0" />
              <span>{Math.round(depth).toLocaleString("en-IN")} m MD · Annular fluid</span>
            </div>
            <div className="text-xs text-ink-2">
              {well.id === referenceWellId
                ? "Formation at bit: "
                : `Reference pick (${referenceWellId} offset): `}
              <span className="font-medium text-ink">
                {referenceFormation?.name ?? `Not covered by ${referenceWellId}`}
              </span>
            </div>

            {well.id !== referenceWellId && (
              <div className="rounded-[4px] bg-status-moderate-soft border border-status-moderate/30 p-1.5 text-xs text-status-moderate">
                Stratigraphy belongs to {referenceWellId}. No source-backed picks exist for {well.id}.
              </div>
            )}

            <div className="text-xs text-ink-3">
              Bit position: {Math.round(depth).toLocaleString("en-IN")} m MD (schematic BHA)
            </div>

            <div className="border-t border-line pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-ink">Operation mode</span>
                {isPlaying && (
                  <span className="text-xs font-medium text-status-moderate">Playback active</span>
                )}
              </div>
              <div role="group" aria-label="Simulated operation mode" className="flex gap-1">
                {([
                  ["drill", "Drill"],
                  ["trip", "Trip"],
                  ["hold", "Hold"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={operation === mode}
                    disabled={isPlaying && mode !== "hold"}
                    onClick={() => setOperation(mode)}
                    className={`flex-1 rounded-[4px] border px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                      operation === mode
                        ? "bg-primary border-accent text-white"
                        : "bg-surface border-line text-ink-2 hover:bg-surface-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs leading-normal text-ink-3">
                {operation === "trip"
                  ? "Tripping one stand at a time; reverses at hole limits."
                  : operation === "drill"
                  ? "Simulated ROP advance; stops at planned TD."
                  : "Drill to advance depth, trip to run stands in/out."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Strata & Events panel (right) */}
      <aside
        aria-label="Reference formations and events"
        className="absolute right-3 top-3 z-10 w-[210px] rounded-[6px] border border-line bg-surface p-2 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      >
        <div role="group" aria-label="Reference information" className="flex border-b border-line pb-1.5 mb-2 gap-1">
          <button
            type="button"
            aria-pressed={referencePanel === "formations"}
            onClick={() => setReferencePanel("formations")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-2 py-1 text-xs font-medium transition ${
              referencePanel === "formations"
                ? "bg-surface-muted text-ink font-semibold border border-line"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            <Layers3 className="h-3.5 w-3.5" />
            Strata
          </button>
          <button
            type="button"
            aria-pressed={referencePanel === "events"}
            onClick={() => setReferencePanel("events")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-2 py-1 text-xs font-medium transition ${
              referencePanel === "events"
                ? "bg-surface-muted text-ink font-semibold border border-line"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            <CircleDot className="h-3.5 w-3.5" />
            Events
          </button>
        </div>

        {referencePanel === "formations" ? (
          <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
            <div className="flex items-center gap-1 text-xs font-medium text-ink-3 pb-1 border-b border-line">
              <Activity className="h-3.5 w-3.5 text-accent" />
              <span>WX-07 reference intervals</span>
            </div>
            {formationIntervals.map((interval, index) => {
              const color = intervalColors[index % intervalColors.length];
              return (
                <div key={interval.name} className="flex items-center gap-2 text-xs text-ink leading-tight">
                  <svg
                    className="h-3 w-3 shrink-0 rounded-[2px] border border-line"
                    data-scene-color={color}
                  >
                    <rect width="12" height="12" fill={color} />
                  </svg>
                  <span className="min-w-0 flex-1 truncate font-medium">{interval.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-3 text-xs">
                    {interval.top}–{interval.bottom}m
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
            <div className="text-xs font-medium text-ink-3 pb-1 border-b border-line">
              Historical WX-07 events
            </div>
            {referenceEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventSelect(event)}
                className="flex w-full items-center gap-2 rounded-[4px] p-1 text-left text-xs text-ink hover:bg-surface-muted transition"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    event.severity === "Critical"
                      ? "bg-status-critical"
                      : event.type === "Mud Loss"
                      ? "bg-status-high"
                      : "bg-status-moderate"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {event.type} · {event.depth}m
                </span>
                <span className="shrink-0 text-ink-3 tabular-nums">{event.date.slice(5)}</span>
              </button>
            ))}
            <p className="mt-2 text-xs leading-normal text-ink-3 border-t border-line pt-1.5">
              Click event to view precedent evidence.
            </p>
          </div>
        )}
      </aside>

      {/* Bottom legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-[6px] border border-line bg-surface/95 px-3 py-1.5 text-xs text-ink-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Down-string flow
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#5c9d94]" />
          Annular return
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#c8a978]" />
          Cuttings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-line-strong" />
          Casing envelope
        </span>
        <span className="text-ink-3">Simulated flow</span>
        <span className="hidden sm:inline text-ink-3">· Drag to rotate · Scroll to zoom</span>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-[4px] border border-line bg-surface/90 px-2 py-1 text-right text-xs text-ink-3">
        Cutaway schematic · Reference depth bands
      </div>
    </div>
  );
}

