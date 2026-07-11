/**
 * critical v9 — public API.
 *
 *   const result = await critical({ src: "dist/index.html", inline: true });
 *
 * Returns a structured, deterministic result (see Result typedef). Nothing is written to disk
 * unless the caller chooses to; it's safe to call speculatively from an agent.
 */
import { Buffer } from "node:buffer";
import { parseHTML } from "linkedom";
import { loadBundle } from "./source.js";
import { routeEngine } from "./detect.js";
import { runStatic } from "./engines/static.js";
import { finalize } from "./css.js";
import { inlineCritical } from "./inline.js";

/**
 * @typedef {object} Result
 * @property {string} css      minified critical CSS
 * @property {string} html     document with critical CSS inlined (=== input html if !inline)
 * @property {object} report   structured diagnostics (engine, reason, sizes, rules, warnings)
 */

const DEFAULTS = {
  engine: "auto", // 'auto' | 'static' | 'render'
  inline: false,
  minify: true,
  foldAware: true,
  width: 1300,
  height: 900,
  dimensions: null, // [{width,height}, ...] overrides width/height for the render engine
  timeout: 30_000,
};

export async function critical(options = {}) {
  const started = process.hrtime.bigint();
  const opts = { ...DEFAULTS, ...options };
  const warnings = [];

  const bundle = await loadBundle(opts);
  const sourceBytes = Buffer.byteLength(bundle.css || "");

  // Short-circuit: no CSS to work with.
  if (!bundle.css.trim()) {
    warnings.push("No CSS found for this document — nothing to extract.");
    return result(bundle.html, "", {
      engine: "none",
      reason: "no stylesheets discovered",
      requestedEngine: opts.engine,
      rules: { kept: 0, total: 0 },
      bytes: { stylesheets: sourceBytes, critical: 0, savedBlocking: 0 },
      stylesheetsDiscovered: bundle.stylesheets,
      warnings,
      durationMs: elapsed(started),
      deterministic: true,
    });
  }

  // 1. Route to an engine.
  let engine = opts.engine;
  let reason;
  if (engine === "auto") {
    const routed = routeEngine(bundle.document);
    engine = routed.engine;
    reason = routed.reason;
  } else {
    reason = `engine pinned to "${engine}" by caller`;
  }

  // 2. Extract.
  let raw = "";
  let kept = 0;
  let total = 0;

  if (engine === "static") {
    const r = runStatic(bundle.document, bundle.css, { foldAware: opts.foldAware });
    raw = r.css;
    kept = r.kept;
    total = r.total;
    if (!r.foldScoped) {
      warnings.push(
        "Static engine matched the whole document (no [data-critical-fold] hint): output is " +
          "'used CSS', a superset of above-the-fold. Add a fold container or use engine:'render' " +
          "for a tighter set.",
      );
    }
  } else if (engine === "render") {
    const { runRender } = await import("./engines/render.js"); // lazy: pulls in Playwright
    const viewports = opts.dimensions ?? [{ width: opts.width, height: opts.height }];
    const r = await runRender({
      html: bundle.html,
      css: bundle.css,
      url: bundle.url,
      viewports,
      timeout: opts.timeout,
      userAgent: opts.userAgent,
    });
    raw = r.css;
  }

  // 3. Finalize (deterministic minify / dedupe / dead-code).
  const css = finalize(raw, { minify: opts.minify });
  const criticalBytes = Buffer.byteLength(css);

  // 4. Inline if asked. Re-parse so we never mutate the tree used for routing.
  let html = bundle.html;
  let stylesheets = [];
  if (opts.inline) {
    const { document } = parseHTML(bundle.html);
    const inlineOpts = typeof opts.inline === "object" ? opts.inline : {};
    ({ stylesheets } = inlineCritical(document, css, inlineOpts));
    html = document.toString();
  }

  return result(html, css, {
    engine,
    reason,
    requestedEngine: opts.engine,
    rules: { kept, total },
    bytes: {
      stylesheets: sourceBytes,
      critical: criticalBytes,
      // bytes no longer render-blocking after inline+defer (the win we actually care about)
      savedBlocking: opts.inline ? sourceBytes : 0,
    },
    stylesheetsDiscovered: bundle.stylesheets,
    stylesheetsDeferred: stylesheets,
    warnings,
    durationMs: elapsed(started),
    deterministic: true,
  });
}

function result(html, css, report) {
  return { html, css, report };
}

function elapsed(startedBigint) {
  return Math.round(Number(process.hrtime.bigint() - startedBigint) / 1e6);
}

export default critical;
