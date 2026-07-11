/**
 * Benchmark helpers — run Beasties and v9 over the same fixtures and measure the inlined
 * critical-CSS payload (the render-blocking bytes that actually matter for LCP).
 *
 * `beasties` is a devDependency used only here and in the vs-beasties tests.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";

export const FIXTURES = path.join(import.meta.dirname, "..", "fixtures");

/** Selectors that style what's visible above a 1300×900 fold in our fixtures. */
export const ABOVE_FOLD = [".nav", ".hero", ".cta", ".logo"];
/** Selectors that only appear below the fold. */
export const BELOW_FOLD = [".footer", ".faq", ".pricing", ".testimonials", ".feature-card"];

/** Extract the critical CSS that a tool inlined into a <style> in <head>. */
export function inlinedCss(html) {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return m ? m[1] : "";
}

export function covers(css, selectors) {
  return selectors.filter((s) => new RegExp(escape(s) + "\\b").test(css));
}
function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Run Beasties on a fixture and report its inlined critical CSS. */
export async function runBeasties(file) {
  const { default: Beasties } = await import("beasties");
  const html = await readFile(path.join(FIXTURES, file), "utf8");
  const beasties = new Beasties({ path: FIXTURES, logLevel: "silent" });
  const out = await beasties.process(html);
  const css = inlinedCss(out);
  return { css, bytes: Buffer.byteLength(css) };
}

/** Is Beasties installed? (devDependency; tests skip cleanly without it.) */
export async function hasBeasties() {
  try {
    await import("beasties");
    return true;
  } catch {
    return false;
  }
}

/** Is Playwright installed with a browser available? */
export async function hasPlaywright() {
  try {
    const { chromium } = await import("playwright");
    return Boolean(chromium.executablePath());
  } catch {
    return false;
  }
}
