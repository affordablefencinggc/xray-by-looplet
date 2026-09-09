import * as THREE from "three";

export interface ArchitecturalDimensioningOptions {
  scene: THREE.Scene;
  bounds: THREE.Box3;
  storeys?: Array<{ label: string; elevation: number }>;
  invalidate: () => void;
}

export interface DimensionData {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  widthLabel: string;
  depthLabel: string;
  heightLabel: string;
  storeys: Array<{
    label: string;
    elevationM: number;
    heightMm?: number;
    tag: string;
  }>;
}

function createTextSprite(text: string, scale = 1.0): THREE.Sprite {
  if (typeof document === "undefined") {
    const material = new THREE.SpriteMaterial({ transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3.2 * scale, 0.8 * scale, 1);
    return sprite;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);

    // Pill background
    ctx.fillStyle = "rgba(11, 29, 51, 0.88)";
    ctx.strokeStyle = "#35e0c2";
    ctx.lineWidth = 2.5;

    const x = 8, y = 8, w = 240, h = 48, r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text label
    ctx.font = "bold 20px 'SF Mono', 'Segoe UI Mono', monospace";
    ctx.fillStyle = "#e2fdf8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2 * scale, 0.8 * scale, 1);
  return sprite;
}

export function createArchitecturalDimensioning(options: ArchitecturalDimensioningOptions) {
  const { scene, bounds, invalidate } = options;
  const min = bounds.min;
  const max = bounds.max;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z);

  const group = new THREE.Group();
  group.name = "architectural-dimensioning";
  group.visible = false;

  const widthMm = Math.round(size.x * 1000);
  const depthMm = Math.round(size.z * 1000);
  const heightMm = Math.round(size.y * 1000);

  const formatMm = (mm: number) => `${mm.toLocaleString()} mm`;

  const rawStoreys = options.storeys ?? [
    { label: "Ground", elevation: min.y },
    { label: "Roof", elevation: max.y },
  ];

  // Sort storeys ascending by elevation
  const sortedStoreys = [...rawStoreys].sort((a, b) => a.elevation - b.elevation);
  const storeyData = sortedStoreys.map((st, i) => {
    const prev = i > 0 ? sortedStoreys[i - 1] : null;
    const diffMm = prev ? Math.round((st.elevation - prev.elevation) * 1000) : undefined;
    const sign = st.elevation >= 0 ? "+" : "";
    const tag = `▼ ${st.label} ${sign}${st.elevation.toFixed(2)}m${diffMm ? ` (↕${diffMm}mm)` : ""}`;
    return {
      label: st.label,
      elevationM: st.elevation,
      heightMm: diffMm,
      tag,
    };
  });

  const data: DimensionData = {
    widthMm,
    depthMm,
    heightMm,
    widthLabel: formatMm(widthMm),
    depthLabel: formatMm(depthMm),
    heightLabel: formatMm(heightMm),
    storeys: storeyData,
  };

  const linePositions: number[] = [];
  const tickLength = span * 0.04;

  // 1. Overall Width Dimension (X axis, placed in front of building along Z = max.z + offset)
  const xOffsetZ = max.z + span * 0.12;
  const xY = min.y;
  // Extension lines
  linePositions.push(min.x, xY, max.z + 0.2, min.x, xY, xOffsetZ + tickLength);
  linePositions.push(max.x, xY, max.z + 0.2, max.x, xY, xOffsetZ + tickLength);
  // Dimension line
  linePositions.push(min.x, xY, xOffsetZ, max.x, xY, xOffsetZ);
  // 45 degree ticks
  linePositions.push(
    min.x - tickLength, xY, xOffsetZ - tickLength,
    min.x + tickLength, xY, xOffsetZ + tickLength,
    max.x - tickLength, xY, xOffsetZ - tickLength,
    max.x + tickLength, xY, xOffsetZ + tickLength,
  );

  const widthSprite = createTextSprite(`↔ ${data.widthLabel}`);
  widthSprite.position.set(center.x, xY + 0.6, xOffsetZ);
  group.add(widthSprite);

  // 2. Overall Depth Dimension (Z axis, placed to the right along X = max.x + offset)
  const zOffsetX = max.x + span * 0.12;
  const zY = min.y;
  // Extension lines
  linePositions.push(max.x + 0.2, zY, min.z, zOffsetX + tickLength, zY, min.z);
  linePositions.push(max.x + 0.2, zY, max.z, zOffsetX + tickLength, zY, max.z);
  // Dimension line
  linePositions.push(zOffsetX, zY, min.z, zOffsetX, zY, max.z);
  // 45 degree ticks
  linePositions.push(
    zOffsetX - tickLength, zY, min.z - tickLength,
    zOffsetX + tickLength, zY, min.z + tickLength,
    zOffsetX - tickLength, zY, max.z - tickLength,
    zOffsetX + tickLength, zY, max.z + tickLength,
  );

  const depthSprite = createTextSprite(`↕ ${data.depthLabel}`);
  depthSprite.position.set(zOffsetX, zY + 0.6, center.z);
  group.add(depthSprite);

  // 3. Overall Height & Storey Datum Strings (Left side along X = min.x - offset)
  const yOffsetX = min.x - span * 0.16;
  const yZ = center.z;
  // Vertical mast line
  linePositions.push(yOffsetX, min.y, yZ, yOffsetX, max.y + 0.5, yZ);

  // Level ticks and sprites
  for (const st of sortedStoreys) {
    // Horizontal tick
    linePositions.push(yOffsetX, st.elevation, yZ, yOffsetX + span * 0.08, st.elevation, yZ);
    // 45 degree tick
    linePositions.push(
      yOffsetX - tickLength * 0.7, st.elevation - tickLength * 0.7, yZ,
      yOffsetX + tickLength * 0.7, st.elevation + tickLength * 0.7, yZ,
    );

    const sign = st.elevation >= 0 ? "+" : "";
    const stSprite = createTextSprite(`▼ ${st.label} ${sign}${st.elevation.toFixed(1)}m`, 0.85);
    stSprite.position.set(yOffsetX - 2.2, st.elevation, yZ);
    group.add(stSprite);
  }

  // Overall height label
  const heightSprite = createTextSprite(`↨ H: ${data.heightLabel}`);
  heightSprite.position.set(yOffsetX - 2.4, center.y, yZ + span * 0.15);
  group.add(heightSprite);

  // Line geometry & material
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: "#35e0c2",
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  scene.add(group);

  let visible = false;

  function setVisible(v: boolean) {
    visible = v;
    group.visible = visible;
    invalidate();
  }

  function toggle(): boolean {
    setVisible(!visible);
    return visible;
  }

  function dispose() {
    scene.remove(group);
    lineGeo.dispose();
    lineMat.dispose();
    group.traverse((child) => {
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }

  return {
    group,
    getData: () => data,
    isVisible: () => visible,
    setVisible,
    toggle,
    dispose,
  };
}
