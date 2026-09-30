/**
 * critical v9 — TypeScript declarations.
 *
 * Extract the critical-path (above-the-fold) CSS from your HTML, inline it, and load the rest
 * asynchronously.
 */

/** Engine used to determine which CSS is critical. */
export type CriticalEngine = "auto" | "static" | "render";

/** A single render viewport. The critical sets of all viewports are unioned. */
export interface CriticalViewport {
  /** Viewport width in pixels. */
  width: number;
  /** Viewport height in pixels. */
  height: number;
}

/**
 * Configuration for the `inline` option. When `inline` is an object, the inliner is configured
 * with these values.
 */
export interface InlineOptions {
  /**
   * Insert a `<link rel="preload" as="style">` hint where each deferred stylesheet was, so the
   * download starts early without blocking the first paint.
   * @default true
   */
  preload?: boolean;
  /**
   * Nonce to set on the injected `<style>` element, for a strict `style-src` Content Security
   * Policy.
   */
  nonce?: string;
}

/**
 * Options accepted by `critical()`.
 *
 * Provide either `src` (a path or URL to an HTML file) or `html` (raw HTML source). All other
 * options are optional.
 */
export interface CriticalOptions {
  /** Path or URL to an HTML file. Provide this **or** `html`. */
  src?: string;
  /** Raw HTML source. Takes precedence over `src`. */
  html?: string;
  /**
   * Extra CSS: file paths, globs, or raw CSS strings, beyond what the document links.
   */
  css?: string | string[];
  /**
   * Base directory for resolving stylesheet/asset paths.
   * @default dir of `src`, else the current working directory
   */
  base?: string;
  /**
   * Engine selection.
   *
   * - `"auto"` (default) — inspects the delivered HTML: rendered documents are matched
   *   statically (fast, no browser); empty SPA shells are escalated to the render engine.
   * - `"static"` — match CSS rules against the delivered DOM. No browser needed.
   * - `"render"` — load the page in Playwright at a real viewport and measure what is painted
   *   above the fold. Requires the optional `playwright` peer dependency.
   * @default "auto"
   */
  engine?: CriticalEngine;
  /**
   * Inline critical CSS and defer the rest. Pass an object to configure inlining.
   * @default false
   */
  inline?: boolean | InlineOptions;
  /**
   * Minify the critical CSS via Lightning CSS.
   * @default true
   */
  minify?: boolean;
  /**
   * Honor `[data-critical-fold]` scoping in the static engine. When a fold container is present,
   * matching is scoped to that subtree, producing a tighter above-the-fold set.
   * @default true
   */
  foldAware?: boolean;
  /**
   * Render-engine viewport width in pixels.
   * @default 1300
   */
  width?: number;
  /**
   * Render-engine viewport height in pixels.
   * @default 900
   */
  height?: number;
  /**
   * Multiple render viewports; their critical sets are unioned. Overrides `width` / `height`.
   */
  dimensions?: CriticalViewport[];
  /**
   * Render-engine navigation timeout in milliseconds.
   * @default 30_000
   */
  timeout?: number;
  /** User agent for the render engine. */
  userAgent?: string;
}

/** Rule counts from the critical extraction pass. */
export interface ReportRules {
  /** Number of CSS rules kept in the critical set. */
  kept: number;
  /** Total number of candidate CSS rules considered. */
  total: number;
}

/** Byte accounting for the critical extraction. */
export interface ReportBytes {
  /** Bytes of the combined input stylesheets (the full, render-blocking set). */
  stylesheets: number;
  /** Bytes of the extracted, finalized critical CSS. */
  critical: number;
  /**
   * Render-blocking bytes removed from the critical path after inline + defer. Non-zero only when
   * `inline` was set.
   */
  savedBlocking: number;
}

/**
 * Structured diagnostics returned alongside the CSS/HTML. Designed to be read by a program: it
 * explains which engine ran and why, quantifies the win, and surfaces any caveats.
 */
export interface CriticalReport {
  /** The engine that actually ran: `"static"`, `"render"`, or `"none"` when no CSS was found. */
  engine: "static" | "render" | "none";
  /** Human-readable explanation of the engine choice. */
  reason: string;
  /** The engine requested by the caller (`"auto"` when the engine was auto-routed). */
  requestedEngine: CriticalEngine;
  /** Rule counts from the critical extraction pass. */
  rules: ReportRules;
  /** Byte accounting for the critical extraction. */
  bytes: ReportBytes;
  /** Stylesheet hrefs discovered in the document. */
  stylesheetsDiscovered: string[];
  /** Stylesheet hrefs that were made non-blocking. Present when `inline` was set. */
  stylesheetsDeferred?: string[];
  /** Non-fatal caveats surfaced during the run. */
  warnings: string[];
  /** Wall-clock time of the run in milliseconds. */
  durationMs: number;
  /** Whether the output is byte-deterministic (always true; same input → same output). */
  deterministic: boolean;
}

/**
 * The result of a `critical()` run. `critical()` never writes to disk on its own; write
 * `result.html` / `result.css` yourself (or use the CLI's `--write` / `--out`).
 */
export interface CriticalResult {
  /** The document. Identical to the input HTML unless `inline` was set. */
  html: string;
  /** The critical CSS, minified (unless `minify: false`). */
  css: string;
  /** Structured diagnostics (engine used, bytes, rules, warnings, timing). */
  report: CriticalReport;
}

/**
 * Extract and inline critical-path CSS from an HTML document.
 *
 * @example
 * import { critical } from "critical";
 *
 * const { html, css, report } = await critical({
 *   src: "dist/index.html",
 *   inline: true,
 * });
 *
 * @param options Options controlling the extraction. Provide `src` or `html` (exactly one).
 * @returns The rewritten document, the critical CSS, and a structured report.
 */
export function critical(
  options: { src: string } & Omit<CriticalOptions, "html">,
): Promise<CriticalResult>;

/**
 * Extract and inline critical-path CSS from an HTML document.
 *
 * @example
 * import { critical } from "critical";
 *
 * const { html, css, report } = await critical({
 *   html: "<!DOCTYPE html><title>hey</title>",
 *   inline: true,
 * });
 *
 * @param options Options controlling the extraction. Provide `src` or `html` (exactly one).
 * @returns The rewritten document, the critical CSS, and a structured report.
 */
export function critical(
  options: { html: string } & Omit<CriticalOptions, "src">,
): Promise<CriticalResult>;

export default critical;
