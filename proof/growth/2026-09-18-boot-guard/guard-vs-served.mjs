/**
 * Runs the SHIPPED guard source against the SERVED document.
 *
 * The CDP browser is degraded in this environment, so this closes the same gap
 * a different way: it fetches the exact bytes the dev server sends, extracts the
 * exact guard the server inlined, parses the real HTML into a minimal DOM, and
 * evaluates the guard with Object.prototype frozen the way the browser has it.
 * The artifact under test is the served one, not a rebuilt fixture.
 *
 * What this cannot cover, and does not claim to: whether a real browser paints
 * the resulting DOM. That needs the browser.
 */
import vm from 'node:vm';

const html = await (await fetch('http://127.0.0.1:8085/')).text();

const VOID_OR_RAW = new Set([
  'script',
  'style',
  'meta',
  'link',
  'br',
  'img',
  'input',
  'hr',
]);

/** Parse a document to the subset of DOM the guard touches. */
function parseDocument(source) {
  const bodyMatch = source.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : source;

  function makeElement(tagName, attrs = {}) {
    return {
      tagName: tagName.toLowerCase(),
      attributes: { ...attrs },
      children: [],
      textContent: '',
      style: { cssText: '' },
      get childElementCount() {
        return this.children.length;
      },
      get firstChild() {
        return this.children[0] ?? null;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return name in this.attributes ? this.attributes[name] : null;
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const at = this.children.indexOf(child);
        if (at !== -1) this.children.splice(at, 1);
        return child;
      },
      querySelector(selector) {
        return query(this, selector);
      },
    };
  }

  function query(node, selector) {
    if (matches(node, selector)) return node;
    for (const child of node.children) {
      const found = query(child, selector);
      if (found) return found;
    }
    return null;
  }

  function matches(node, selector) {
    if (selector.startsWith('[') && selector.endsWith(']')) {
      return selector.slice(1, -1) in node.attributes;
    }
    if (selector.startsWith('#')) return node.attributes.id === selector.slice(1);
    return node.tagName === selector.toLowerCase();
  }

  function textOf(node) {
    const own = node.textContent || '';
    return own + node.children.map(textOf).join(' ');
  }

  const root = makeElement('body');
  const stack = [root];
  // A single pass over tags and text. `script`/`style` contents are markup to
  // the parser but content to the page, so their bodies are skipped wholesale.
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g;
  let token;
  let skipUntil = null;
  while ((token = tokenRe.exec(bodyHtml)) !== null) {
    const [, closing, tag, attrText, selfClosing, text] = token;
    const name = tag ? tag.toLowerCase() : null;

    if (text !== undefined) {
      if (skipUntil) continue;
      const trimmed = text.replace(/\s+/g, ' ').trim();
      if (trimmed) stack[stack.length - 1].textContent += trimmed;
      continue;
    }

    if (skipUntil) {
      if (closing && name === skipUntil) skipUntil = null;
      continue;
    }

    if (name === 'script' || name === 'style') {
      if (!closing) skipUntil = name;
      continue;
    }

    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const attrs = {};
    const attrRe = /([a-zA-Z-]+)="([^"]*)"/g;
    let attr;
    while ((attr = attrRe.exec(attrText || '')) !== null) attrs[attr[1]] = attr[2];
    const element = makeElement(name, attrs);
    stack[stack.length - 1].appendChild(element);
    if (!selfClosing && !VOID_OR_RAW.has(name)) stack.push(element);
  }

  return {
    document: {
      body: root,
      getElementById: (id) => query(root, '#' + id),
      querySelector: (selector) => query(root, selector),
      createElement: (tag) => makeElement(tag),
    },
    root,
    textOf,
  };
}

// The guard the server actually inlined.
const inlineMatch = html.match(/<script>(\(function bootGuard[\s\S]*?)<\/script>/);
if (!inlineMatch) throw new Error('the served document carries no inline bootGuard');
const shippedGuard = inlineMatch[1];

console.log(
  JSON.stringify({
    servedBytes: html.length,
    guardInlinedInServedDocument: true,
    guardSourceBytes: shippedGuard.length,
    documentHasRoot: /id="root"/.test(html),
    documentHasWorkspaceStartup: /workspace-startup/.test(html),
  }),
);

/**
 * Evaluate the shipped guard against the served document.
 *
 * `freeze` runs in a fresh child process' worth of isolation by restoring the
 * descriptor immediately, so the two cases cannot contaminate each other.
 */
function run(label, freeze) {
  const { document, root, textOf } = parseDocument(html);
  const saved = Object.getOwnPropertyDescriptor(Object.prototype, 'toString');

  const sandbox = { document, Object, String };
  vm.createContext(sandbox);
  if (freeze) Object.freeze(Object.prototype);

  let threw = null;
  try {
    vm.runInContext(shippedGuard, sandbox, { filename: 'served-index.html' });
  } catch (error) {
    threw = error.message;
  }

  const marked = document.querySelector('[data-boot-failure]');
  const result = {
    case: label,
    threw,
    documentHasRoot: Boolean(document.getElementById('root')),
    marked: marked ? marked.tagName : null,
    marker: marked ? marked.getAttribute('data-boot-failure') : null,
    panelText: marked ? textOf(marked).replace(/\s+/g, ' ').trim().slice(0, 220) : null,
    hostChildCount: root.childElementCount,
  };

  if (!freeze && saved) {
    Object.defineProperty(Object.prototype, 'toString', saved);
  }
  return result;
}

console.log(JSON.stringify(run('healthy globals', false), null, 2));
console.log(JSON.stringify(run('frozen Object.prototype', true), null, 2));
