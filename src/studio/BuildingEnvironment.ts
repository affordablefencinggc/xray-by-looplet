import * as THREE from "three";
import type { BuildingAppearance, EnvironmentId } from "./buildingAppearance";

// Presentation skies only: no weather data, wind loads or structural simulation.
export function createBuildingEnvironment(scene: THREE.Scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!,
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let settings: BuildingAppearance | null = null,
    last = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const skies: Record<Exclude<EnvironmentId, "studio">, [string, string, string]> = {
    daylight: ["#4E86BA", "#ADCDE2", "#E4E5DB"],
    sunset: ["#28233F", "#C07167", "#F3C28A"],
    "blue-hour": ["#101E3B", "#46658C", "#AE9DB0"],
    mist: ["#909DA7", "#CBD3D4", "#E3E5DF"],
    storm: ["#111C28", "#465768", "#8C9A9B"],
    cyclone: ["#0D1823", "#344B5A", "#849491"],
    midnight: ["#050C1C", "#15223D", "#38465B"],
  };
  function draw(time: number) {
    if (!settings) return;
    const env = settings.environment;
    if (env === "studio") {
      scene.background = new THREE.Color(settings.background);
      scene.fog = null;
      return;
    }
    const colors = skies[env],
      gradient = ctx.createLinearGradient(0, 0, 0, 768);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.62, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 768);
    if (env === "sunset" || env === "daylight") {
      const x = env === "sunset" ? 780 : 800,
        y = env === "sunset" ? 460 : 190,
        r = env === "sunset" ? 170 : 100;
      const glow = ctx.createRadialGradient(x, y, 8, x, y, r);
      glow.addColorStop(0, "#FFF3CDE0");
      glow.addColorStop(0.2, "#FFDFAB99");
      glow.addColorStop(1, "#FFD39100");
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.arc(x, y, env === "sunset" ? 26 : 15, 0, Math.PI * 2);
      ctx.fillStyle = "#FFF0CF";
      ctx.fill();
    }
    if (env === "midnight" || env === "blue-hour")
      for (let i = 0; i < 90; i++) {
        const x = (i * 7919) % 1024,
          y = (i * 1543) % 440;
        ctx.fillStyle = i % 3 === 0 ? "#DBE3ED99" : "#DBE3ED44";
        ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
      }
    const storm = env === "storm" || env === "cyclone";
    const phase = !reduced.matches && settings.animateWeather ? time * 0.000015 : 0;
    if (env !== "midnight")
      for (let i = 0; i < (storm ? 80 : 18); i++) {
        const angle = i * 0.58 + phase * (env === "cyclone" ? 1 : 0),
          r = 50 + (i % 20) * 25;
        const x =
          env === "cyclone" ? 650 + Math.cos(angle) * r : ((i * 157 + phase * 350) % 1350) - 120;
        const y = env === "cyclone" ? 220 + Math.sin(angle) * r * 0.3 : 70 + ((i * 83) % 330);
        const width = storm ? 180 : 160,
          height = storm ? 45 : 19;
        const cloud = ctx.createRadialGradient(x, y, 0, x, y, width);
        cloud.addColorStop(
          0,
          storm
            ? `rgba(7,16,25,${0.15 + settings.weatherIntensity * 0.24})`
            : "rgba(242,231,223,.15)",
        );
        cloud.addColorStop(1, "rgba(40,50,65,0)");
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, height / width);
        ctx.translate(-x, -y);
        ctx.fillStyle = cloud;
        ctx.fillRect(x - width, y - width, width * 2, width * 2);
        ctx.restore();
      }
    if (storm) {
      ctx.strokeStyle = `rgba(192,209,222,${0.07 + settings.weatherIntensity * 0.13})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 110 * settings.weatherIntensity; i++) {
        const x = ((i * 239 + phase * 1400) % 1200) - 90,
          y = ((i * 137 + phase * 8500) % 950) - 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 23, y + 60);
        ctx.stroke();
      }
    }
    texture.needsUpdate = true;
    scene.background = texture;
  }
  return {
    set(value: BuildingAppearance) {
      settings = value;
      draw(performance.now());
    },
    tick() {
      if (
        !settings ||
        !settings.animateWeather ||
        reduced.matches ||
        !["storm", "cyclone"].includes(settings.environment) ||
        document.hidden
      )
        return false;
      const now = performance.now();
      if (now - last > 80) {
        draw(now);
        last = now;
      }
      return true;
    },
    dispose() {
      texture.dispose();
    },
  };
}
