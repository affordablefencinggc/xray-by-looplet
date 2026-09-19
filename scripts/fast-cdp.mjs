#!/usr/bin/env node
/**
 * Repo-native raw Chrome DevTools Protocol runner.
 *
 * The hot path is deliberately small: one Node process, one browser-level
 * WebSocket and one in-memory declarative opcode batch.  No Playwright,
 * Puppeteer, Selenium or agent-browser process participates in a campaign.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DEADLINE_MS = 30_000;
const MAX_SCENARIO_BYTES = 32_000_000;
const SAFE_SCREENSHOT = /^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.png$/;

class InfrastructureFailure extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "InfrastructureFailure";
  }
}

class ProductFailure extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ProductFailure";
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function matchesExpectedCancellation(event, request, expectation) {
  return event.canceled === true && event.errorText === "net::ERR_ABORTED"
    && event.type === "Fetch" && request?.method === "GET"
    && request.url === expectation.url && expectation.observed < expectation.maximum;
}

export function waitForFunctionSource(predicate, timeout) {
  const source = JSON.stringify(String(predicate));
  return `new Promise((resolve,reject)=>{
    const source=${source}; let observer; let frame=0; let timer; let running=false; let settled=false;
    const clean=()=>{ observer?.disconnect(); if(frame) cancelAnimationFrame(frame); clearTimeout(timer); };
    const test=async()=>{
      if(settled || running) return settled;
      running=true;
      try {
        const candidate=(0,eval)(source);
        const value=await (typeof candidate==='function'?candidate():candidate);
        if(settled) return true;
        if(value){ settled=true; clean(); resolve(true); return true; }
      } catch(error) { if(!settled){ settled=true; clean(); reject(error); } return true; }
      finally { running=false; }
      return false;
    };
    const tick=async()=>{ if(!await test() && !settled) frame=requestAnimationFrame(tick); };
    observer=new MutationObserver(()=>{ void test(); });
    observer.observe(document,{subtree:true,childList:true,attributes:true,characterData:true});
    timer=setTimeout(()=>{ settled=true; clean(); reject(Error('wait-for-function deadline: '+source)); },${timeout});
    void tick();
  })`;
}

function compact(value) {
  if (typeof value === "string" && value.length > 2_000) return `${value.slice(0, 2_000)}…`;
  const encoded = JSON.stringify(value);
  if (encoded && encoded.length > 8_000) return { truncated: true, preview: encoded.slice(0, 8_000) };
  return value;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new InfrastructureFailure(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new InfrastructureFailure(`Missing value for ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  for (const required of ["endpoint-file", "scenario", "output"]) {
    if (!values[required]) throw new InfrastructureFailure(`Missing --${required}`);
  }
  return values;
}

async function writeNew(path, value) {
  await writeFile(path, value, { flag: "wx" });
}

async function readScenario(path, origin) {
  const bytes = await readFile(path);
  if (bytes.byteLength > MAX_SCENARIO_BYTES) throw new InfrastructureFailure("Scenario exceeds 32 MB quota");
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new InfrastructureFailure(`Scenario is not valid JSON: ${error.message}`, { cause: error });
  }
  const operations = Array.isArray(parsed) ? parsed : parsed?.operations;
  if (!Array.isArray(operations)) throw new InfrastructureFailure("Scenario must be an opcode array or { operations: [] }");
  const replace = (value) => {
    if (typeof value === "string") return value.replaceAll("{{ORIGIN}}", origin ?? "");
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  return { bytes, input: parsed, operations: replace(operations) };
}

class CdpSocket {
  constructor(url, deadlineMs = DEFAULT_DEADLINE_MS) {
    this.url = url;
    this.deadlineMs = deadlineMs;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
  }

  async connect() {
    if (typeof WebSocket !== "function") throw new InfrastructureFailure("Node runtime does not expose WebSocket");
    this.websocket = new WebSocket(this.url);
    await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => rejectPromise(new InfrastructureFailure("CDP connection deadline")), this.deadlineMs);
      this.websocket.addEventListener("open", () => {
        clearTimeout(timer);
        resolvePromise();
      }, { once: true });
      this.websocket.addEventListener("error", () => {
        clearTimeout(timer);
        rejectPromise(new InfrastructureFailure("CDP connection failed"));
      }, { once: true });
    });
    this.websocket.addEventListener("message", ({ data }) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new InfrastructureFailure(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
    this.websocket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new InfrastructureFailure(`CDP closed while waiting for ${pending.method}`));
      }
      this.pending.clear();
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  call(method, params = {}, sessionId, deadlineMs = this.deadlineMs) {
    return new Promise((resolvePromise, rejectPromise) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new InfrastructureFailure(`${method} deadline`));
      }, deadlineMs);
      this.pending.set(id, { method, resolve: resolvePromise, reject: rejectPromise, timer });
      this.websocket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  async evaluate(expression, sessionId, { userGesture = false, deadlineMs = 120_000 } = {}) {
    const reply = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture,
    }, sessionId, deadlineMs);
    if (reply.exceptionDetails) {
      const message = reply.exceptionDetails.exception?.description
        ?? reply.exceptionDetails.exception?.value
        ?? reply.exceptionDetails.text
        ?? "Browser evaluation failed";
      throw new ProductFailure(String(message));
    }
    return reply.result?.value;
  }

  close() {
    if (this.websocket?.readyState === WebSocket.OPEN) this.websocket.close();
  }
}

function browserValue(argument) {
  if (Object.hasOwn(argument, "value")) return argument.value;
  if (argument.unserializableValue) return argument.unserializableValue;
  return argument.description ?? argument.type ?? "unknown";
}

function safeScreenshotPath(output, requested) {
  if (typeof requested !== "string" || !SAFE_SCREENSHOT.test(requested) || requested.includes("..") || isAbsolute(requested)) {
    throw new InfrastructureFailure(`Invalid screenshot path: ${requested}`);
  }
  const outputRoot = resolve(output);
  const target = resolve(outputRoot, requested);
  if (target !== outputRoot && !target.startsWith(`${outputRoot}${sep}`)) throw new InfrastructureFailure("Screenshot escapes output directory");
  return target;
}

class FastCdpCampaign {
  constructor(socket, output) {
    this.socket = socket;
    this.output = resolve(output);
    this.contexts = new Map();
    this.sessions = new Map();
    this.receipts = [];
    this.browserErrors = [];
    this.browserErrorKeys = new Set();
    this.requests = new Map();
    this.expectedCancellations = [];
    this.observedCancellations = [];
    this.screenshots = [];
    this.cleanup = { attempted: false, disposed: [], errors: [] };
    this.removeEventListener = socket.onEvent((message) => this.receiveEvent(message));
  }

  context(name) {
    const context = this.contexts.get(name);
    if (!context) throw new InfrastructureFailure(`Unknown context: ${name}`);
    return context;
  }

  addBrowserError(error) {
    const normalized = {
      context: error.context ?? null,
      kind: error.kind,
      message: String(error.message ?? "Unknown browser error"),
      url: error.url ?? null,
      timestamp: new Date().toISOString(),
    };
    const key = `${normalized.context}|${normalized.kind}|${normalized.message}|${normalized.url}`;
    if (this.browserErrorKeys.has(key)) return;
    this.browserErrorKeys.add(key);
    this.browserErrors.push(normalized);
  }

  receiveEvent(message) {
    const contextName = this.sessions.get(message.sessionId);
    if (!contextName) return;
    const params = message.params ?? {};
    const requestKey = `${message.sessionId}:${params.requestId}`;
    if (message.method === "Network.requestWillBeSent") {
      this.requests.set(requestKey, { url: params.request?.url, method: params.request?.method, initiator: params.initiator?.type });
    }
    if (message.method === "Runtime.consoleAPICalled" && params.type === "error") {
      this.addBrowserError({
        context: contextName,
        kind: "console-error",
        message: (params.args ?? []).map(browserValue).map(String).join(" "),
      });
    } else if (message.method === "Runtime.exceptionThrown") {
      this.addBrowserError({
        context: contextName,
        kind: "uncaught-exception",
        message: params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text,
        url: params.exceptionDetails?.url,
      });
    } else if (message.method === "Log.entryAdded" && params.entry?.level === "error") {
      this.addBrowserError({
        context: contextName,
        kind: "log-error",
        message: params.entry.text,
        url: params.entry.url,
      });
    } else if (message.method === "Network.loadingFailed") {
      const request = this.requests.get(requestKey);
      const expectation = this.expectedCancellations.find(entry => matchesExpectedCancellation(params, request, entry));
      if (expectation) {
        expectation.observed++;
        this.observedCancellations.push({ context: contextName, url: request.url, reason: expectation.reason, event: params, timestamp: new Date().toISOString() });
        return;
      }
      this.addBrowserError({
        context: contextName,
        kind: "resource-load-failed",
        message: `${params.type ?? "Resource"}: ${params.errorText ?? "load failed"}${params.canceled ? " (cancelled)" : ""}`,
        url: this.requests.get(requestKey)?.url ?? params.requestId,
      });
    } else if (message.method === "Network.responseReceived" && Number(params.response?.status) >= 400) {
      this.addBrowserError({
        context: contextName,
        kind: "resource-http-error",
        message: `${params.type ?? "Resource"}: HTTP ${params.response.status}`,
        url: params.response.url,
      });
    } else if (message.method === "Inspector.targetCrashed") {
      this.addBrowserError({ context: contextName, kind: "target-crashed", message: "Browser target crashed" });
    }
  }

  throwIfBrowserErrors() {
    if (!this.browserErrors.length) return;
    const first = this.browserErrors[0];
    throw new ProductFailure(`${first.kind} in ${first.context ?? "browser"}: ${first.message}${first.url ? ` (${first.url})` : ""}`);
  }

  async createContext(name) {
    if (typeof name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new InfrastructureFailure(`Invalid context name: ${name}`);
    if (this.contexts.has(name)) throw new InfrastructureFailure(`Context already exists: ${name}`);
    const { browserContextId } = await this.socket.call("Target.createBrowserContext", { disposeOnDetach: true });
    await this.socket.call("Browser.setDownloadBehavior", { behavior: "deny", browserContextId });
    const { targetId } = await this.socket.call("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await this.socket.call("Target.attachToTarget", { targetId, flatten: true });
    const context = { name, browserContextId, targetId, sessionId, mouse: { x: 0, y: 0, button: "none", buttons: 0 } };
    this.contexts.set(name, context);
    this.sessions.set(sessionId, name);
    await Promise.all([
      this.socket.call("Page.enable", {}, sessionId),
      this.socket.call("Runtime.enable", {}, sessionId),
      this.socket.call("Network.enable", {}, sessionId),
      this.socket.call("Log.enable", {}, sessionId),
      this.socket.call("Inspector.enable", {}, sessionId),
      this.socket.call("DOM.enable", {}, sessionId),
      this.socket.call("Accessibility.enable", {}, sessionId),
    ]);
    return { created: name, targetId };
  }

  async defaultContext() {
    if (!this.contexts.has("default")) await this.createContext("default");
    return this.context("default");
  }

  async disposeContext(name) {
    const context = this.context(name);
    await this.socket.call("Target.disposeBrowserContext", { browserContextId: context.browserContextId });
    this.contexts.delete(name);
    this.sessions.delete(context.sessionId);
    return { disposed: name };
  }

  async waitForFunction(context, predicate, deadlineMs = 60_000) {
    const timeout = Number(deadlineMs);
    if (!Number.isFinite(timeout) || timeout < 100 || timeout > 120_000) throw new InfrastructureFailure(`Invalid wait deadline: ${deadlineMs}`);
    return this.socket.evaluate(waitForFunctionSource(predicate, timeout), context.sessionId, { deadlineMs: timeout + 5_000 });
  }

  async dispatchMouse(context, type, x, y, button = "none", buttons = 0, clickCount = 0) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) throw new InfrastructureFailure("Mouse coordinates must be finite numbers");
    await this.socket.call("Input.dispatchMouseEvent", { type, x: px, y: py, button, buttons, clickCount, pointerType: "mouse" }, context.sessionId);
    context.mouse = { x: px, y: py, button, buttons };
  }

  async screenshot(context, file) {
    const target = safeScreenshotPath(this.output, file);
    await mkdir(dirname(target), { recursive: true });
    const { data } = await this.socket.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    }, context.sessionId, 30_000);
    const bytes = Buffer.from(data, "base64");
    await writeNew(target, bytes);
    const receipt = {
      eventId: randomUUID(),
      context: context.name,
      targetId: context.targetId,
      file: relative(this.output, target).replaceAll("\\", "/"),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    };
    this.screenshots.push(receipt);
    return receipt;
  }

  async clickAccessible(context, arguments_) {
    const [roleKeyword, role, action, nameKeyword, name, exactFlag] = arguments_;
    if (roleKeyword !== "role" || action !== "click" || nameKeyword !== "--name" || typeof name !== "string") {
      throw new InfrastructureFailure("find syntax is: ['find','role','<role>','click','--name','<accessible name>','--exact?']");
    }
    const exact = exactFlag === "--exact";
    const { nodes = [] } = await this.socket.call("Accessibility.getFullAXTree", {}, context.sessionId);
    const matches = nodes.filter((node) => {
      if (node.ignored || node.role?.value !== role || typeof node.backendDOMNodeId !== "number") return false;
      const accessibleName = String(node.name?.value ?? "");
      return exact ? accessibleName === name : accessibleName.toLocaleLowerCase().includes(name.toLocaleLowerCase());
    });
    if (!matches.length) throw new ProductFailure(`No accessible ${role} named ${JSON.stringify(name)}`);
    if (matches.length > 1) throw new ProductFailure(`Accessible ${role} named ${JSON.stringify(name)} is ambiguous (${matches.length} matches)`);
    const match = matches[0];
    const disabled = (match.properties ?? []).find((property) => property.name === "disabled")?.value?.value;
    if (disabled === true) throw new ProductFailure(`Accessible ${role} named ${JSON.stringify(name)} is disabled`);
    await this.socket.call("DOM.scrollIntoViewIfNeeded", { backendNodeId: match.backendDOMNodeId }, context.sessionId);
    const model = await this.socket.call("DOM.getBoxModel", { backendNodeId: match.backendDOMNodeId }, context.sessionId);
    const quad = model.model?.border ?? model.model?.content;
    if (!Array.isArray(quad) || quad.length !== 8) throw new ProductFailure(`Accessible ${role} named ${JSON.stringify(name)} has no clickable box`);
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
    const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    await this.dispatchMouse(context, "mouseMoved", x, y, "none", 0);
    await this.dispatchMouse(context, "mousePressed", x, y, "left", 1, 1);
    await this.dispatchMouse(context, "mouseReleased", x, y, "left", 0, 1);
    return { role, name, exact, backendDOMNodeId: match.backendDOMNodeId, point: { x, y } };
  }

  async resolvePoint(context, expression) {
    const source = JSON.stringify(String(expression));
    const point = await this.socket.evaluate(`(()=>{const source=${source};const candidate=(0,eval)(source);const value=typeof candidate==='function'?candidate():candidate;if(Array.isArray(value)&&value.length>=2)return{x:Number(value[0]),y:Number(value[1])};if(value&&typeof value==='object')return{x:Number(value.x),y:Number(value.y)};throw Error('Drag point expression must return {x,y} or [x,y]')})()`, context.sessionId);
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new ProductFailure("Drag point expression returned non-finite coordinates");
    return point;
  }

  async dragPointer(context, fromX, fromY, toX, toY, requestedSteps = 8, requestedButton = "left") {
    const steps = Number(requestedSteps);
    if (!Number.isInteger(steps) || steps < 1 || steps > 100) throw new InfrastructureFailure(`Invalid drag step count: ${requestedSteps}`);
    const button = String(requestedButton);
    const buttons = button === "left" ? 1 : button === "right" ? 2 : button === "middle" ? 4 : 0;
    if (!buttons) throw new InfrastructureFailure(`Unsupported drag button: ${button}`);
    await this.dispatchMouse(context, "mouseMoved", fromX, fromY, "none", 0);
    await this.dispatchMouse(context, "mousePressed", fromX, fromY, button, buttons, 1);
    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      await this.dispatchMouse(
        context,
        "mouseMoved",
        Number(fromX) + (Number(toX) - Number(fromX)) * fraction,
        Number(fromY) + (Number(toY) - Number(fromY)) * fraction,
        button,
        buttons,
      );
    }
    await this.dispatchMouse(context, "mouseReleased", toX, toY, button, 0, 1);
    return { from: [Number(fromX), Number(fromY)], to: [Number(toX), Number(toY)], steps, button };
  }

  async execute(operation) {
    if (!Array.isArray(operation) || !operation.length || typeof operation[0] !== "string") {
      throw new InfrastructureFailure("Each operation must be a non-empty opcode tuple");
    }
    const [rawOpcode, ...inputArgs] = operation;
    if (rawOpcode === "expect-cancelled-fetch") {
      const [url, maximum, reason] = inputArgs;
      if (inputArgs.length !== 3 || typeof url !== "string" || !/^http:\/\/127\.0\.0\.1:\d+\/[^?#]*$/.test(url)
        || !Number.isInteger(maximum) || maximum < 1 || maximum > 10 || typeof reason !== "string" || reason.length < 20) {
        throw new InfrastructureFailure("Expected cancellation needs an exact loopback GET URL, a bounded count and a reviewed reason");
      }
      this.expectedCancellations.push({ url, maximum, reason, observed: 0 });
      return { url, maximum, reason };
    }
    let args = inputArgs;
    let compatibility = false;
    let compatibilityOpcode = rawOpcode;
    if (rawOpcode === "set" && inputArgs[0] === "viewport") {
      compatibility = true;
      compatibilityOpcode = "viewport";
      args = ["default", inputArgs[1], inputArgs[2]];
    } else if (rawOpcode === "open" && typeof inputArgs[0] === "string" && /^https?:\/\//.test(inputArgs[0])) {
      compatibility = true;
      compatibilityOpcode = "navigate";
      args = ["default", inputArgs[0]];
    } else if (rawOpcode === "wait" && inputArgs[0] === "--fn") {
      compatibility = true;
      args = ["default", inputArgs[1], inputArgs[2]];
    } else if ((rawOpcode === "eval" || rawOpcode === "screenshot") && inputArgs.length === 1) {
      compatibility = true;
      args = ["default", inputArgs[0]];
    } else if (rawOpcode === "find") {
      compatibility = true;
      args = ["default", ...inputArgs];
    } else if (rawOpcode === "key") {
      if (inputArgs.length < 1 || inputArgs.length > 2) {
        throw new InfrastructureFailure("Key syntax is: ['key','<key>',optionalModifierBitmask]");
      }
      compatibility = true;
      args = ["default", ...inputArgs];
    } else if (rawOpcode === "drag" && inputArgs[0] === "--from") {
      compatibility = true;
      args = ["default", ...inputArgs];
    } else if (rawOpcode === "errors" && inputArgs.length === 0) {
      this.throwIfBrowserErrors();
      return { count: 0 };
    }
    if (compatibility) await this.defaultContext();
    const aliases = {
      create: "context",
      open: "navigate",
      setViewport: "viewport",
      evaluate: "eval",
      waitForFunction: "wait",
      mouse_move: "mouseMove",
      mouse_down: "mouseDown",
      mouse_up: "mouseUp",
    };
    const opcode = aliases[compatibilityOpcode] ?? compatibilityOpcode;
    if (opcode === "context") return this.createContext(args[0]);
    const context = this.context(args[0]);
    if (opcode === "navigate") {
      const url = String(args[1] ?? "");
      if (!/^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/.test(url) && !/^https?:\/\/localhost(?::\d+)?(?:\/|$)/.test(url)) {
        throw new InfrastructureFailure(`Navigation must stay on loopback: ${url}`);
      }
      const result = await this.socket.call("Page.navigate", { url }, context.sessionId);
      if (result.errorText) throw new InfrastructureFailure(`Navigation failed: ${result.errorText}`);
      return { frameId: result.frameId, url };
    }
    if (opcode === "viewport") {
      const width = Number(args[1]);
      const height = Number(args[2]);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || width > 4_096 || height < 320 || height > 4_096) {
        throw new InfrastructureFailure(`Invalid viewport: ${args[1]}x${args[2]}`);
      }
      await this.socket.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, context.sessionId);
      return { width, height, deviceScaleFactor: 1 };
    }
    if (opcode === "wait") return this.waitForFunction(context, args[1], args[2]);
    if (opcode === "eval") return compact(await this.socket.evaluate(String(args[1] ?? ""), context.sessionId, { userGesture: true }));
    if (opcode === "key") {
      const definitions = {
        ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", virtualKeyCode: 37 },
        ArrowUp: { key: "ArrowUp", code: "ArrowUp", virtualKeyCode: 38 },
        ArrowRight: { key: "ArrowRight", code: "ArrowRight", virtualKeyCode: 39 },
        ArrowDown: { key: "ArrowDown", code: "ArrowDown", virtualKeyCode: 40 },
        Escape: { key: "Escape", code: "Escape", virtualKeyCode: 27 },
        Enter: { key: "Enter", code: "Enter", virtualKeyCode: 13, text: "\r" },
        Tab: { key: "Tab", code: "Tab", virtualKeyCode: 9 },
        Space: { key: " ", code: "Space", virtualKeyCode: 32, text: " " },
        Home: { key: "Home", code: "Home", virtualKeyCode: 36 },
        End: { key: "End", code: "End", virtualKeyCode: 35 },
      };
      const name = args[1];
      if (typeof name !== "string" || !Object.hasOwn(definitions, name)) {
        throw new InfrastructureFailure(`Unsupported key: ${String(name)}`);
      }
      const modifiers = args[2] ?? 0;
      if (!Number.isInteger(modifiers) || modifiers < 0 || modifiers > 15) {
        throw new InfrastructureFailure("Key modifiers must be an integer bitmask from 0 to 15 (Alt=1, Control=2, Meta=4, Shift=8)");
      }
      const definition = definitions[name];
      const common = {
        key: definition.key,
        code: definition.code,
        windowsVirtualKeyCode: definition.virtualKeyCode,
        nativeVirtualKeyCode: definition.virtualKeyCode,
        modifiers,
        isKeypad: false,
      };
      await this.socket.call("Input.dispatchKeyEvent", {
        ...common,
        type: definition.text ? "keyDown" : "rawKeyDown",
        ...(definition.text ? { text: definition.text, unmodifiedText: definition.text } : {}),
        autoRepeat: false,
      }, context.sessionId);
      await this.socket.call("Input.dispatchKeyEvent", { ...common, type: "keyUp" }, context.sessionId);
      return { key: name, modifiers, method: "Input.dispatchKeyEvent down/up" };
    }
    if (opcode === "assert") {
      const predicate = JSON.stringify(String(args[1] ?? "false"));
      const message = JSON.stringify(String(args[2] ?? `Assertion failed in ${context.name}`));
      return this.socket.evaluate(`(()=>{const source=${predicate};const candidate=(0,eval)(source);const value=typeof candidate==='function'?candidate():candidate;if(!value)throw Error(${message});return value===true?true:value})()`, context.sessionId);
    }
    if (opcode === "mouseMove") {
      await this.dispatchMouse(context, "mouseMoved", args[1], args[2], context.mouse.button, context.mouse.buttons);
      return { x: Number(args[1]), y: Number(args[2]) };
    }
    if (opcode === "mouseDown") {
      const button = args[3] ?? "left";
      const buttons = button === "left" ? 1 : button === "right" ? 2 : button === "middle" ? 4 : 0;
      await this.dispatchMouse(context, "mouseMoved", args[1], args[2], "none", 0);
      await this.dispatchMouse(context, "mousePressed", args[1], args[2], button, buttons, Number(args[4] ?? 1));
      return { x: Number(args[1]), y: Number(args[2]), button };
    }
    if (opcode === "mouseUp") {
      const button = args[3] ?? (context.mouse.button === "none" ? "left" : context.mouse.button);
      await this.dispatchMouse(context, "mouseReleased", args[1] ?? context.mouse.x, args[2] ?? context.mouse.y, button, 0, Number(args[4] ?? 1));
      return { x: Number(args[1] ?? context.mouse.x), y: Number(args[2] ?? context.mouse.y), button };
    }
    if (opcode === "find") return this.clickAccessible(context, args.slice(1));
    if (opcode === "drag" && args[1] === "--from") {
      const fromIndex = args.indexOf("--from");
      const toIndex = args.indexOf("--to");
      const stepsIndex = args.indexOf("--steps");
      const buttonIndex = args.indexOf("--button");
      if (fromIndex === -1 || toIndex === -1 || toIndex !== fromIndex + 2) {
        throw new InfrastructureFailure("Expression drag syntax is: ['drag','--from','<JS>','--to','<JS>','--steps','8','--button','left']");
      }
      const from = await this.resolvePoint(context, args[fromIndex + 1]);
      const to = await this.resolvePoint(context, args[toIndex + 1]);
      return this.dragPointer(context, from.x, from.y, to.x, to.y, stepsIndex === -1 ? 8 : args[stepsIndex + 1], buttonIndex === -1 ? "left" : args[buttonIndex + 1]);
    }
    if (opcode === "drag") {
      const [fromX, fromY, toX, toY, requestedSteps = 8, requestedButton = "left"] = args.slice(1);
      return this.dragPointer(context, fromX, fromY, toX, toY, requestedSteps, requestedButton);
    }
    if (opcode === "screenshot") return this.screenshot(context, args[1]);
    if (opcode === "errors") {
      this.throwIfBrowserErrors();
      return { count: 0 };
    }
    if (opcode === "dispose") return this.disposeContext(args[0]);
    throw new InfrastructureFailure(`Unsupported opcode: ${rawOpcode}`);
  }

  async run(operations) {
    for (let index = 0; index < operations.length; index += 1) {
      this.throwIfBrowserErrors();
      const operation = operations[index];
      const started = performance.now();
      try {
        const value = await this.execute(operation);
        this.throwIfBrowserErrors();
        this.receipts.push({ index, opcode: operation[0], context: operation[1] ?? null, elapsedMs: performance.now() - started, value: compact(value) });
      } catch (error) {
        this.receipts.push({ index, opcode: operation?.[0] ?? null, context: operation?.[1] ?? null, elapsedMs: performance.now() - started, error: error.message });
        for (const context of this.contexts.values()) {
          try { await this.screenshot(context, `failure-op-${index}-${context.name}.png`); }
          catch (captureError) { this.receipts.push({ index, diagnostic: "failure-screenshot", error: captureError.message }); }
        }
        if (error instanceof ProductFailure || error instanceof InfrastructureFailure) throw error;
        throw new InfrastructureFailure(`Opcode ${index} (${operation?.[0] ?? "unknown"}) failed: ${error.message}`, { cause: error });
      }
    }
    for (const context of this.contexts.values()) {
      await this.socket.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", context.sessionId);
    }
    this.throwIfBrowserErrors();
  }

  async cleanupContexts() {
    this.cleanup.attempted = true;
    for (const [name, context] of [...this.contexts.entries()]) {
      try {
        await this.socket.call("Target.disposeBrowserContext", { browserContextId: context.browserContextId });
        this.cleanup.disposed.push(name);
      } catch (error) {
        this.cleanup.errors.push({ context: name, message: error.message });
      } finally {
        this.contexts.delete(name);
        this.sessions.delete(context.sessionId);
      }
    }
    this.removeEventListener();
    if (this.cleanup.errors.length) throw new InfrastructureFailure(`Context cleanup failed: ${this.cleanup.errors[0].message}`);
  }
}

async function hashSourceFiles(scenarioPath) {
  const candidates = [
    join(SCRIPT_DIR, "fast-cdp.mjs"),
    join(SCRIPT_DIR, "run-fast-cdp.ps1"),
    join(SCRIPT_DIR, "invoke-dans1-fast-cdp.ps1"),
    resolve(scenarioPath),
  ];
  const entries = {};
  for (const path of candidates) {
    try {
      const bytes = await readFile(path);
      entries[path === resolve(scenarioPath) ? `scenario:${basename(path)}` : basename(path)] = sha256(bytes);
    } catch (error) {
      if (path === resolve(scenarioPath)) throw error;
    }
  }
  return entries;
}

async function collectManifest(root, current = root) {
  const entries = [];
  for (const item of await readdir(current, { withFileTypes: true })) {
    const path = join(current, item.name);
    if (item.isDirectory()) entries.push(...await collectManifest(root, path));
    else if (item.isFile() && item.name !== "sha256-manifest.json") {
      const bytes = await readFile(path);
      entries.push({ path: relative(root, path).replaceAll("\\", "/"), bytes: bytes.byteLength, sha256: sha256(bytes) });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function main() {
  const executionHost = hostname().trim().split(".")[0].toLowerCase();
  if (executionHost !== "dans1") {
    throw new InfrastructureFailure(`Raw-CDP product execution is restricted to DANS1; observed ${executionHost}`);
  }
  const options = parseArguments(process.argv.slice(2));
  const output = resolve(options.output);
  await mkdir(output, { recursive: true });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let socket;
  let campaign;
  let operations = [];
  let browserVersion = null;
  let browserCommandLine = null;
  let failure = null;
  let cleanupFailure = null;
  let sourceHashes = {};
  let scenarioSha256 = null;
  try {
    const scenario = await readScenario(resolve(options.scenario), options.origin);
    scenarioSha256 = sha256(scenario.bytes);
    operations = scenario.operations;
    sourceHashes = await hashSourceFiles(options.scenario);
    await writeNew(join(output, "scenario.json"), `${JSON.stringify(scenario.input, null, 2)}\n`);
    const endpointLines = (await readFile(resolve(options["endpoint-file"]), "utf8")).trim().split(/\r?\n/);
    const port = Number(endpointLines[0]);
    const websocketPath = endpointLines[1];
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^\/devtools\/browser\//.test(websocketPath ?? "")) {
      throw new InfrastructureFailure("Invalid DevToolsActivePort file");
    }
    socket = new CdpSocket(`ws://127.0.0.1:${port}${websocketPath}`);
    await socket.connect();
    browserVersion = await socket.call("Browser.getVersion");
    browserCommandLine = await socket.call("Browser.getBrowserCommandLine");
    const args = browserCommandLine.arguments ?? [];
    if (args.some((argument) => /^--(no-sandbox|disable-setuid-sandbox|single-process|disable-seccomp-filter-sandbox|disable-gpu-sandbox)(=|$)/.test(argument))) {
      throw new InfrastructureFailure("Unsafe browser sandbox argument detected");
    }
    campaign = new FastCdpCampaign(socket, output);
    await writeNew(join(output, "run-binding.json"), `${JSON.stringify({
      runId: options["run-id"] ?? randomUUID(),
      host: hostname(),
      startedAt,
      node: process.version,
      browserVersion,
      browserCommandLine,
      endpoint: { host: "127.0.0.1", port },
      origin: options.origin ?? null,
      sourceHashes,
      scenarioSha256,
    }, null, 2)}\n`);
    await campaign.run(operations);
  } catch (error) {
    failure = error;
  } finally {
    if (campaign) {
      try {
        await campaign.cleanupContexts();
      } catch (error) {
        cleanupFailure = error;
      }
    }
    socket?.close();
  }
  if (cleanupFailure && !failure) failure = cleanupFailure;
  const verdict = failure ? (failure instanceof ProductFailure ? "FAIL" : "INFRA_FAILURE") : "PASS";
  const results = {
    schemaVersion: 1,
    method: "raw CDP hot-socket declarative opcode batch; fail-fast; reactive readiness",
    host: hostname(),
    startedAt,
    completedAt: new Date().toISOString(),
    node: process.version,
    browserVersion,
    sourceHashes,
    scenarioSha256,
    plannedOperations: operations.length,
    completedOperations: campaign?.receipts.filter((receipt) => !receipt.error).length ?? 0,
    elapsedMs: performance.now() - started,
    verdict,
    error: failure ? { name: failure.name, message: failure.message } : null,
    browserErrors: campaign?.browserErrors ?? [],
    expectedCancellations: campaign?.expectedCancellations ?? [],
    observedCancellations: campaign?.observedCancellations ?? [],
    screenshots: campaign?.screenshots ?? [],
    cleanup: campaign?.cleanup ?? { attempted: false, disposed: [], errors: [] },
    receipts: campaign?.receipts ?? [],
    limitations: [
      "Browser-level CDP is host authority and is never delegated to untrusted workers.",
      "This runner proves the supplied loopback scenario only; it does not claim deployment or live-device verification.",
    ],
  };
  try {
    await writeNew(join(output, "browser-results.json"), `${JSON.stringify(results, null, 2)}\n`);
    const manifest = {
      schemaVersion: 1,
      host: hostname(),
      generatedAt: new Date().toISOString(),
      entries: await collectManifest(output),
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    await writeNew(join(output, "sha256-manifest.json"), manifestBytes);
    process.stdout.write(`${JSON.stringify({ ...results, receipts: undefined, manifestSha256: sha256(manifestBytes) })}\n`);
  } catch (writeError) {
    process.stderr.write(`Failed to preserve structured evidence: ${writeError.stack ?? writeError}\n`);
    process.exitCode = 2;
    return;
  }
  if (failure) process.exitCode = verdict === "FAIL" ? 1 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 2;
});
