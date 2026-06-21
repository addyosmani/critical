/**
 * Engine routing. Given a delivered HTML document, decide whether the cheap-and-correct
 * static engine is *correct here*, or whether we must escalate to a real browser.
 *
 * This is the capability Beasties structurally can't have (no browser to escalate to) and
 * that v8 never needed (it always pays for the browser). The whole "faster on static, correct
 * on SPAs" claim lives in this file.
 */

const SHELL_MOUNTS = [
  "#root",
  "#app",
  "#__next",
  "#__nuxt",
  "#__svelte",
  "#q-app",
  "[data-reactroot]",
  "[data-server-rendered]",
  "astro-island",
];

/**
 * @param {Document} document  linkedom Document of the *delivered* HTML
 * @returns {{ engine: 'static'|'render', reason: string, signals: object }}
 */
export function routeEngine(document) {
  const signals = inspect(document);

  // 1. A near-empty <body> whose only real content is a known framework mount node is an
  //    un-rendered SPA shell. There is no DOM to match selectors against -> must render.
  if (signals.isShell) {
    return {
      engine: "render",
      reason: `SPA shell detected (mount: ${signals.mount ?? "empty <body>"}, ${signals.elementCount} body elements) — no above-the-fold DOM to match statically`,
      signals,
    };
  }

  // 2. Not a shell -> the delivered DOM *is* the truth, whatever its size. Static is correct
  //    and far cheaper. We escalate to a browser only on positive evidence of a shell (above),
  //    never just because a page is small — a minimal MPA page shouldn't boot Chrome.
  return {
    engine: "static",
    reason: `rendered document (${signals.elementCount} elements, ${signals.textLength} chars of text) — matching used CSS without a browser`,
    signals,
  };
}

function inspect(document) {
  const body = document.body;
  if (!body) {
    return { isShell: true, mount: null, elementCount: 0, textLength: 0 };
  }

  const all = body.querySelectorAll("*");
  // Ignore script/style/template noise when judging "is there real content here"
  const meaningful = [...all].filter(
    (el) => !/^(SCRIPT|STYLE|TEMPLATE|LINK|NOSCRIPT)$/.test(el.tagName),
  );
  const elementCount = meaningful.length;
  const textLength = (body.textContent || "").trim().length;

  let mount = null;
  for (const sel of SHELL_MOUNTS) {
    const node = safeQuery(body, sel);
    if (node) {
      mount = sel;
      // Is the mount essentially empty? (the SPA hasn't rendered into it)
      const inner = node.querySelectorAll("*");
      const innerMeaningful = [...inner].filter(
        (el) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName),
      ).length;
      if (innerMeaningful <= 1 && (node.textContent || "").trim().length < 10) {
        return { isShell: true, mount, elementCount, textLength };
      }
    }
  }

  const isShell = elementCount <= 2 && textLength < 10;
  return { isShell, mount, elementCount, textLength };
}

function safeQuery(root, selector) {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}
