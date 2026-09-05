import * as THREE from "three";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { drawScopeReticle, routeScopeWheel } from "./precisionScope.ts";

type ScopeCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
import {
  normalizeScopeOptions,
  scopePointer,
  scopeFrame,
  type ModelScopeOptions,
  type ScopeFrame,
} from "./precisionScope.ts";
export {
  normalizeScopeOptions,
  scopePointer,
  scopeFrame,
  type ModelScopeOptions,
} from "./precisionScope.ts";

/** Copies into an owned camera, preserving the source camera and any pre-existing crop. */
export function projectScopeCamera(source: ScopeCamera, lens: ScopeCamera, frame: ScopeFrame) {
  if (source instanceof THREE.PerspectiveCamera && lens instanceof THREE.PerspectiveCamera)
    lens.copy(source, false);
  else if (source instanceof THREE.OrthographicCamera && lens instanceof THREE.OrthographicCamera)
    lens.copy(source, false);
  else throw new Error("Scope camera projection must match its source");
  // A camera can belong to a transformed parent. The lens is deliberately unparented.
  source.matrixWorld.decompose(lens.position, lens.quaternion, lens.scale);
  lens.updateMatrixWorld(true);
  const view = source.view?.enabled ? source.view : null;
  const scaleX = view ? view.width / frame.width : 1;
  const scaleY = view ? view.height / frame.height : 1;
  lens.setViewOffset(
    view?.fullWidth ?? frame.width,
    view?.fullHeight ?? frame.height,
    (view?.offsetX ?? 0) + frame.sampleLeft * scaleX,
    (view?.offsetY ?? 0) + frame.sampleTop * scaleY,
    frame.sampleSize * scaleX,
    frame.sampleSize * scaleY,
  );
  // Perspective.setViewOffset updates aspect; preserve the actual source projection.
  if (lens instanceof THREE.PerspectiveCamera && source instanceof THREE.PerspectiveCamera) {
    lens.aspect = source.aspect;
    lens.updateProjectionMatrix();
  }
  return lens;
}

/** Preserve public renderer state even when scene rendering or pixel readback fails. */
export function withScopeRendererState(renderer: THREE.WebGLRenderer, draw: () => void) {
  const target = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace(),
    mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new THREE.Vector4());
  const scissor = renderer.getScissor(new THREE.Vector4());
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  const shadowAutoUpdate = renderer.shadowMap.autoUpdate,
    shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
  const xrEnabled = renderer.xr.enabled;
  const infoAutoReset = renderer.info.autoReset,
    renderInfo = { ...renderer.info.render };
  try {
    renderer.autoClear = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.xr.enabled = false;
    renderer.info.autoReset = false;
    renderer.setScissorTest(false);
    draw();
  } finally {
    renderer.setRenderTarget(target, face, mip);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
    renderer.xr.enabled = xrEnabled;
    renderer.info.autoReset = infoAutoReset;
    Object.assign(renderer.info.render, renderInfo);
  }
}

export function createModelScope({
  host,
  renderer,
  scene,
  getCamera,
  onInvalidate,
  onZoomChange,
}: {
  host: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getCamera: () => ScopeCamera;
  onInvalidate: () => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const overlay = document.createElement("div");
  overlay.className = "model-scope";
  overlay.dataset.modelScope = "true";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "absolute",
    display: "none",
    pointerEvents: "none",
    overflow: "hidden",
    borderRadius: "50%",
    boxSizing: "border-box",
    zIndex: "3",
    boxShadow:
      "inset 0 0 0 2px var(--scope-rim, #bec4c7), inset 0 0 0 4px var(--scope-ink, #273237)",
  });
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    display: "block",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  });
  overlay.appendChild(canvas);
  host.appendChild(overlay);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    overlay.remove();
    throw new Error("Model scope requires a 2D canvas");
  }
  const linearTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const outputTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const output = new OutputPass();
  const perspective = new THREE.PerspectiveCamera(),
    orthographic = new THREE.OrthographicCamera();
  let options = normalizeScopeOptions({ enabled: false, zoom: 4, diameter: 240 });
  let pointer: { clientX: number; clientY: number } | null = null;
  let disposed = false;
  let visibleFrame: ScopeFrame | null = null;
  const originalCursor = renderer.domElement?.style?.cursor ?? "";
  let pixels = new Uint8Array(4);
  let flipped = context.createImageData(1, 1);
  const hide = () => {
    overlay.style.display = "none";
    visibleFrame = null;
    if (renderer.domElement?.style) renderer.domElement.style.cursor = originalCursor;
  };
  const move = (event: PointerEvent) => {
    pointer = { clientX: event.clientX, clientY: event.clientY };
    if (options.enabled) onInvalidate();
  };
  const leave = () => {
    pointer = null;
    hide();
  };
  const wheel = (event: WheelEvent) => {
    if (!options.enabled || !visibleFrame || event.target !== renderer.domElement) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const point = scopePointer(
      event.clientX,
      event.clientY,
      rect,
      host.clientWidth,
      host.clientHeight,
    );
    if (point)
      routeScopeWheel(event, point, visibleFrame, options.zoom, (zoom) => {
        options = { ...options, zoom };
        overlay.dataset.zoom = String(zoom);
        onZoomChange?.(zoom);
        onInvalidate();
      });
  };
  host.addEventListener("wheel", wheel, { capture: true, passive: false });
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", leave);
  host.addEventListener("pointercancel", leave);
  return {
    setOptions(value: ModelScopeOptions) {
      if (disposed) return;
      options = normalizeScopeOptions(value);
      overlay.dataset.zoom = String(options.zoom);
      if (!options.enabled) hide();
      onInvalidate();
    },
    render() {
      if (disposed || !options.enabled || !pointer) {
        hide();
        return;
      }
      const rect = host.getBoundingClientRect();
      const scaleX = rect.width / (host.offsetWidth || rect.width);
      const scaleY = rect.height / (host.offsetHeight || rect.height);
      const point = scopePointer(
        pointer.clientX,
        pointer.clientY,
        {
          left: rect.left + host.clientLeft * scaleX,
          top: rect.top + host.clientTop * scaleY,
          width: host.clientWidth * scaleX,
          height: host.clientHeight * scaleY,
        },
        host.clientWidth,
        host.clientHeight,
      );
      if (!point) {
        hide();
        return;
      }
      const frame = scopeFrame(
        host.clientWidth,
        host.clientHeight,
        point,
        options,
        renderer.getPixelRatio(),
      );
      if (!frame) {
        hide();
        return;
      }
      if (canvas.width !== frame.pixels || canvas.height !== frame.pixels) {
        canvas.width = canvas.height = frame.pixels;
        linearTarget.setSize(frame.pixels, frame.pixels);
        outputTarget.setSize(frame.pixels, frame.pixels);
        pixels = new Uint8Array(frame.pixels * frame.pixels * 4);
        flipped = context.createImageData(frame.pixels, frame.pixels);
      }
      const source = getCamera();
      const lens = projectScopeCamera(
        source,
        source instanceof THREE.PerspectiveCamera ? perspective : orthographic,
        frame,
      );
      try {
        withScopeRendererState(renderer, () => {
          renderer.setRenderTarget(linearTarget);
          renderer.clear(true, true, true);
          renderer.render(scene, lens);
          output.render(renderer, outputTarget, linearTarget, 0, false);
          renderer.readRenderTargetPixels(outputTarget, 0, 0, frame.pixels, frame.pixels, pixels);
        });
      } catch (error) {
        hide();
        throw error;
      }
      const stride = frame.pixels * 4;
      for (let y = 0; y < frame.pixels; y++) {
        flipped.data.set(
          pixels.subarray((frame.pixels - y - 1) * stride, (frame.pixels - y) * stride),
          y * stride,
        );
      }
      context.putImageData(flipped, 0, 0);
      const ratio = frame.pixels / frame.diameter;
      context.save();
      context.scale(ratio, ratio);
      drawScopeReticle(context, frame.diameter, options.zoom);
      context.restore();
      Object.assign(overlay.style, {
        display: "block",
        left: `${frame.left}px`,
        top: `${frame.top}px`,
        width: `${frame.diameter}px`,
        height: `${frame.diameter}px`,
      });
      visibleFrame = frame;
      if (renderer.domElement?.style) renderer.domElement.style.cursor = "none";
      overlay.dataset.reticle = "three-post";
      overlay.dataset.projection = source.type;
      overlay.dataset.sample = `${frame.sampleLeft},${frame.sampleTop},${frame.sampleSize}`;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (renderer.domElement?.style) renderer.domElement.style.cursor = originalCursor;
      host.removeEventListener("wheel", wheel, true);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointercancel", leave);
      linearTarget.dispose();
      outputTarget.dispose();
      output.dispose();
      overlay.remove();
      pixels = new Uint8Array(0);
    },
  };
}
