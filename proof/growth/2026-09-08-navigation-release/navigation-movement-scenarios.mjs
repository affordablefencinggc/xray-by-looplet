import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Serialized into a normal agent-browser eval opcode; never imports an automation driver.
function installNavigationProof(config) {
  const canvas = document.querySelector(config.canvasSelector);
  if (!canvas) throw Error('Navigation canvas missing: ' + config.canvasSelector);
  const sample = () => {
    const position = (canvas.dataset.cameraPosition ?? '').split(',').map(Number);
    const yaw = Number(canvas.dataset.navigationYaw ?? canvas.dataset.navYaw);
    const pitch = Number(canvas.dataset.navigationPitch ?? canvas.dataset.navPitch);
    const speed = Number(canvas.dataset.navigationSpeed);
    if (position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(yaw) || !Number.isFinite(pitch) || !Number.isFinite(speed))
      throw Error('Actual camera position/yaw/pitch/speed telemetry is not ready');
    return { position, yaw, pitch, speed, mode: canvas.dataset.navigation, capture: canvas.dataset.navigationCapture };
  };
  const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'];
  const key = (type, code) => canvas.dispatchEvent(new KeyboardEvent(type, { code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Escape' ? 'Escape' : code, bubbles: true, cancelable: true }));
  const state = { config, canvas, results: [], active: null, error: null, watchdog: 0, sample, key };
  state.cleanup = (exit = true) => {
    for (const code of codes) key('keyup', code);
    state.active = null;
    cancelAnimationFrame(state.watchdog);
    if (exit) key('keydown', 'Escape');
  };
  const fail = message => { state.error = message; state.cleanup(); throw Error(message); };
  state.fail = fail;
  state.ensure = () => {
    if (state.error) throw Error(state.error);
    const current = sample();
    if (current.mode !== config.mode || canvas.dataset.navigationTransition !== 'idle') return fail('Expected settled ' + config.mode + ' navigation');
    return current;
  };
  state.rotate = () => {
    const before = state.ensure();
    canvas.focus({ preventScroll: true });
    if (Math.abs(Math.sin(before.yaw)) >= 0.15) return before;
    if (document.pointerLockElement === canvas) {
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: -225, movementY: 0, bubbles: true }));
    } else if (before.capture === 'drag') {
      const box = canvas.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, pointerType: 'mouse', buttons: 1, clientX: x - 225, clientY: y, bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, pointerType: 'mouse', button: 0, buttons: 0, clientX: x - 225, clientY: y, bubbles: true }));
    } else return fail('No supported look input for nonzero-yaw test');
    return { requestedYawChange: 0.45, previous: before };
  };
  state.begin = code => {
    const before = state.ensure();
    if (before.speed > 0.01) return fail('Previous movement has not settled');
    if (Math.abs(Math.sin(before.yaw)) < 0.15) return fail('Movement test requires nonzero yaw');
    for (const value of codes) key('keyup', value);
    canvas.focus({ preventScroll: true });
    state.active = { code, before, started: performance.now(), reached: false };
    const watch = () => {
      if (!state.active) return;
      if (performance.now() - state.active.started > 5000) {
        state.error = 'Movement deadline exceeded; keys released and navigation exited';
        state.cleanup(); return;
      }
      state.watchdog = requestAnimationFrame(watch);
    };
    state.watchdog = requestAnimationFrame(watch);
    key('keydown', code);
    return { code, before };
  };
  state.displaced = () => {
    if (state.error) return true; // Advance to the explicit assertion, never leave a held key on a bail.
    if (!state.active) return fail('No movement step is active');
    const current = state.ensure();
    const distance = Math.hypot(...current.position.map((value, i) => value - state.active.before.position[i]));
    state.active.reached = distance >= config.displacement;
    return state.active.reached;
  };
  state.release = () => {
    if (state.error) throw Error(state.error);
    if (!state.active?.reached) return fail('Displacement threshold was not reached');
    key('keyup', state.active.code);
    state.active.released = true;
    return { released: state.active.code, observed: sample() };
  };
  state.settled = () => state.error !== null || sample().speed <= 0.005;
  state.verify = () => {
    if (state.error) throw Error(state.error);
    const step = state.active;
    if (!step?.released) return fail('Key was not released');
    const after = state.ensure(), delta = after.position.map((value, i) => value - step.before.position[i]);
    const { yaw, pitch } = step.before, p = config.mode === 'walk' ? 0 : pitch;
    const forward = [-Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)];
    const horizontalForward = [-Math.sin(yaw), 0, -Math.cos(yaw)];
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const dot = vector => delta.reduce((sum, value, i) => sum + value * vector[i], 0);
    const isForward = step.code === 'KeyW' || step.code === 'KeyS';
    const sign = step.code === 'KeyW' || step.code === 'KeyD' ? 1 : -1;
    const signed = sign * dot(isForward ? forward : right), distance = Math.hypot(...delta);
    if (distance < config.displacement || signed < distance * 0.9) return fail(step.code + ' moved in the wrong camera-relative direction');
    if (isForward && sign * dot(horizontalForward) <= 0.001) return fail(step.code + ' horizontal direction is inverted');
    if (config.mode === 'walk' && Math.abs(delta[1]) > 0.002) return fail('Walk changed selected eye height');
    if (!isForward && Math.abs(delta[1]) > 0.01) return fail('Strafe changed altitude');
    if (config.expectedEyeHeight !== undefined && Math.abs(after.position[1] - config.expectedEyeHeight) > 0.002) return fail('Walk eye height differs from expected floor elevation');
    const result = { code: step.code, before: step.before, after, delta, distance, signedCameraDot: signed, horizontalForwardDot: dot(horizontalForward), rightDot: dot(right) };
    state.results.push(result); state.active = null; cancelAnimationFrame(state.watchdog);
    return result;
  };
  window.__navigationMovementProof ??= {};
  window.__navigationMovementProof[config.tag]?.cleanup(false);
  window.__navigationMovementProof[config.tag] = state;
  return { ready: true, selector: config.canvasSelector, mode: config.mode, actualCamera: sample() };
}

export function navigationMovementSegment({ canvasSelector, mode, tag, screenshotPrefix = `screenshots/growth/2026-09-08-navigation/${tag}`, displacement = 0.12, expectedEyeHeight } = {}) {
  if (!canvasSelector || !['fly', 'walk'].includes(mode) || !/^[a-z0-9-]+$/.test(tag)) throw Error('Specify canvasSelector, fly/walk mode and safe tag');
  if (!Number.isFinite(displacement) || displacement < 0.05 || displacement > 1) throw Error('Displacement threshold must be 0.05..1 model metres');
  if (expectedEyeHeight !== undefined && (mode !== 'walk' || !Number.isFinite(expectedEyeHeight))) throw Error('Expected eye height is a finite walk-only assertion');
  const config = { canvasSelector, mode, tag, displacement, expectedEyeHeight };
  const target = `document.querySelector(${JSON.stringify(canvasSelector)})`;
  const state = `window.__navigationMovementProof[${JSON.stringify(tag)}]`;
  const commands = [
    ['wait', '--fn', `(()=>{const c=${target};return c?.dataset.navigation===${JSON.stringify(mode)}&&c.dataset.navigationTransition==='idle'&&!!c.dataset.cameraPosition&&Number(c.dataset.navigationSpeed)<=0.005})()`],
    ['eval', `(()=>{const c=${target};window.__navigationMovementReadyFrames??={};const frame=Number(c.dataset.frameCount);if(!Number.isFinite(frame))throw Error('Frame telemetry missing');window.__navigationMovementReadyFrames[${JSON.stringify(tag)}]=frame;return {settledAtFrame:frame}})()`],
    ['wait', '--fn', `Number(${target}.dataset.frameCount)>window.__navigationMovementReadyFrames[${JSON.stringify(tag)}]`],
    ['eval', `(${installNavigationProof.toString()})(${JSON.stringify(config)})`],
    ['eval', `${state}.rotate()`],
    ['wait', '--fn', `Math.abs(Math.sin(Number(${target}.dataset.navigationYaw??${target}.dataset.navYaw)))>=0.15`],
    ['screenshot', `${screenshotPrefix}-before.png`],
  ];
  for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) commands.push(
    ['eval', `${state}.begin(${JSON.stringify(code)})`],
    ['wait', '--fn', `${state}.displaced()`],
    ['eval', `${state}.release()`],
    ['wait', '--fn', `${state}.settled()`],
    ['eval', `${state}.verify()`],
  );
  commands.push(
    ['screenshot', `${screenshotPrefix}-moved.png`],
    ['eval', `(()=>{const s=${state};s.cleanup();return {keysReleased:true,movements:s.results}})()`],
    ['wait', '--fn', `${target}.dataset.navigation==='orbit'&&document.pointerLockElement!==${target}`],
    ['screenshot', `${screenshotPrefix}-escaped.png`],
    ['errors'],
  );
  return commands;
}

export const SOURCE_CANVAS = '.building-canvas canvas';
export const ARCHITECT_CANVAS = 'canvas[aria-label="Live architectural 3D model"]';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  for (const [viewer, canvasSelector] of [['source', SOURCE_CANVAS], ['architect', ARCHITECT_CANVAS]]) {
    for (const mode of ['fly', 'walk']) {
      const tag = `${viewer}-${mode}`;
      const file = path.join(directory, `${tag}-movement.json`);
      const commands = navigationMovementSegment({ canvasSelector, mode, tag });
      fs.writeFileSync(file, JSON.stringify(commands, null, 2) + '\n');
      console.log(JSON.stringify({ file, commands: commands.length, executed: false }));
    }
  }
}
