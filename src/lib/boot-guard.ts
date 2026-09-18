/**
 * The guard that runs before the application bundle.
 *
 * polygon-clipping@0.15.7 bundles splaytree, whose `Tree.prototype.toString = …`
 * is a plain property assignment evaluated while the module is being evaluated.
 * If `Object.prototype.toString` is read-only, that assignment throws before any
 * React or router boundary exists, so the failure replaces the whole UI with an
 * error card — or, when the throw happens at module scope, with nothing at all.
 *
 * The global itself is often unrepairable: in the environment this was written
 * for, `Object.getOwnPropertyDescriptor(Object.prototype, "toString")` reports
 * `{writable: false, configurable: false}`, so `Object.defineProperty` throws
 * `Cannot redefine property: toString`. Where it *is* configurable the guard
 * repairs it and the app boots normally; where it is not, the app is already
 * lost and the guard's job is to say so in words instead of leaving a blank page.
 *
 * It is emitted as a classic inline script ahead of the module entry, which is
 * the only point in the document that is guaranteed to execute first.
 */

/** Runs in the browser. Kept dependency-free and ES5-compatible. */
function bootGuard() {
  /**
   * The server document is not the SPA document: TanStack Start renders its own
   * container and `#root` does not exist there. Resolving the host at failure
   * time — rather than bailing out at the top — is the difference between a
   * named failure and the silent white screen this guard was written to remove.
   */
  function resolveHost() {
    return (
      document.getElementById("root") ||
      document.querySelector("[data-boot-host]") ||
      document.body
    );
  }

  function fail(message: string) {
    const host = resolveHost();
    if (!host) return;
    host.setAttribute("data-boot-failure", "globals");
    // The guard runs before the module, so anything already here is the server's
    // startup skeleton — the placeholder this failure is meant to replace. Left
    // in place it would silently sit above the panel and still read as a hang.
    while (host.firstChild) host.removeChild(host.firstChild);
    const card = document.createElement("main");
    card.style.cssText =
      "min-height:100vh;display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;gap:12px;padding:24px;text-align:center;" +
      "font:14px/1.5 ui-sans-serif,system-ui,sans-serif;background:#050b14;color:#f4f4f5";
    const title = document.createElement("h1");
    title.textContent = "X-Ray could not start";
    title.style.cssText = "margin:0;font-size:18px;font-weight:600";
    const body = document.createElement("p");
    body.style.cssText = "margin:0;max-width:34rem;color:#a1a1aa";
    body.textContent =
      "This browser has made Object.prototype.toString read-only, so a drawing " +
      "dependency cannot load. " +
      message +
      " Reload in a browser where Object.prototype.toString is writable.";
    card.appendChild(title);
    card.appendChild(body);
    host.appendChild(card);
  }

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "toString");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail("The property could not be inspected: " + detail + ".");
    return;
  }
  if (!descriptor || typeof descriptor.value !== "function") {
    fail("The property is missing or is not a method.");
    return;
  }
  if (descriptor.writable) return;

  try {
    Object.defineProperty(Object.prototype, "toString", {
      value: descriptor.value,
      writable: true,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
    });
  } catch {
    fail("It is not configurable, so it cannot be repaired in place.");
  }
}

/**
 * The same guard as source text, for `<script>` injection.
 *
 * `bootGuard` is defined standalone so this file's own import of it is a plain
 * function reference and never a template-interpolation site.
 */
export const BOOT_GUARD_SOURCE = `(${bootGuard.toString()})();`;

export { bootGuard };
