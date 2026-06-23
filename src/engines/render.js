/**
 * Render engine — the correct path for SPAs and anything where the delivered HTML isn't the
 * truth. This is Critical's original bet, modernized: a real browser at a real viewport, asked
 * for exactly the rules that style what's painted above the fold.
 *
 * `playwright` is an OPTIONAL peer dependency. It is imported lazily, so the default install and
 * the static path never touch a browser binary. If it's missing we throw a precise, actionable
 * error instead of a module-not-found stack.
 */

/**
 * @param {object} input
 * @param {string} input.html      full HTML source (shell or rendered)
 * @param {string} input.css       combined stylesheet text to evaluate
 * @param {string} [input.url]     URL/path the document came from (file:// or http(s))
 * @param {Array<{width:number,height:number}>} input.viewports
 * @param {number} [input.timeout=30000]
 * @param {string} [input.userAgent]
 * @returns {Promise<{ css: string, viewports: number }>}
 */
export async function runRender({ html, css, url, viewports, timeout = 30_000, userAgent }) {
  const { chromium } = await loadPlaywright();

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const collected = [];
    for (const { width, height } of sortBySmallestFirst(viewports)) {
      const context = await browser.newContext({
        viewport: { width, height },
        userAgent,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      try {
        // Load + run the document. Navigating to the real URL is what lets the browser fetch and
        // execute everything a user would - external/module scripts that render an SPA, relative
        // stylesheets, dynamic assets. A raw HTML string with no URL falls back to setContent,
        // which can only run inline scripts and can't resolve relative resources.
        if (url) {
          await page.goto(url, { waitUntil: "networkidle", timeout });
        } else {
          await page.setContent(html, { waitUntil: "networkidle", timeout });
        }
        // Inject our resolved stylesheet bundle as a known sheet so coverage still maps back to
        // our rules even if a linked sheet failed to load (e.g. a root-relative href under file://).
        if (css) await page.addStyleTag({ content: css });

        const critical = await page.evaluate(extractAboveFold, { width, height });
        collected.push(critical);
      } finally {
        await context.close();
      }
    }
    // Combine across viewports; dedupe happens in the Lightning CSS finalize pass upstream.
    return { css: collected.join("\n"), viewports: viewports.length };
  } finally {
    await browser.close();
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "The render engine needs Playwright, which is an optional peer dependency.\n" +
        "Install it once:  npm i -D playwright && npx playwright install chromium\n" +
        "Or pin the cheap path:  critical <dir> --engine static",
    );
  }
}

function sortBySmallestFirst(viewports) {
  return [...viewports].sort((a, b) => (a.width || 0) - (b.width || 0));
}

/**
 * Runs IN THE BROWSER. Walks every CSSOM rule and keeps it only if at least one element it
 * targets currently intersects the viewport box (true above-the-fold), plus the unconditional
 * keep-list (@font-face, @keyframes, :root vars, html/body). Returns serialized CSS text.
 */
function extractAboveFold({ width, height }) {
  const keep = [];
  const fold = { top: 0, left: 0, right: width, bottom: height };

  const intersects = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < fold.bottom && r.bottom > fold.top && r.left < fold.right && r.right > fold.left;
  };

  const matchesAboveFold = (selector) => {
    let nodes;
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      return true; // exotic selector -> keep
    }
    for (const el of nodes) if (intersects(el)) return true;
    return false;
  };

  const visit = (rules) => {
    for (const rule of rules) {
      // CSSStyleRule
      if (rule.selectorText !== undefined) {
        const surviving = rule.selectorText
          .split(",")
          .map((s) => s.trim())
          .filter((s) => matchesAboveFold(s.replace(/::?[\w-]+(\([^)]*\))?/g, "") || "*"));
        if (surviving.length) keep.push(`${surviving.join(",")}{${rule.style.cssText}}`);
        continue;
      }
      // Unconditional keeps + recurse into conditional groups
      const type = rule.constructor?.name || "";
      if (/FontFace|Keyframes|Property|CounterStyle|FontFeature/.test(type)) {
        keep.push(rule.cssText);
      } else if (rule.cssRules) {
        const inner = [];
        visitInto(rule.cssRules, inner);
        if (inner.length) {
          const open = rule.cssText.slice(0, rule.cssText.indexOf("{") + 1);
          keep.push(`${open}${inner.join("")}}`);
        }
      }
    }
  };

  const visitInto = (rules, sink) => {
    const before = keep.length;
    visit(rules);
    sink.push(...keep.splice(before));
  };

  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      /* cross-origin sheet, skip */
    }
  }
  return keep.join("\n");
}
