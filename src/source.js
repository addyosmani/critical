/**
 * Source loading. Turn the user's input (an HTML string, a file, or a directory) plus its
 * referenced/explicit CSS into a single normalized bundle the engines can consume.
 *
 * Replaces v8's vinyl + oust + got + globby + find-up stack with: linkedom (parse), fs/promises,
 * the global fetch, and fs.glob — all Baseline Node.
 */
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";

/**
 * @typedef {object} Bundle
 * @property {string} html        raw HTML
 * @property {Document} document  parsed linkedom document
 * @property {string} css         combined stylesheet text (links + <style> + explicit css)
 * @property {string[]} stylesheets  hrefs discovered in the document
 * @property {string} base        base directory for asset resolution
 * @property {string} [url]       absolute url/path of the source (for the render engine)
 */

/**
 * @param {object} options
 * @param {string} [options.html]   inline HTML source (takes precedence over src)
 * @param {string} [options.src]    path or URL to an HTML file
 * @param {string|string[]} [options.css]  explicit CSS paths/globs/strings
 * @param {string} [options.base]   base dir; defaults to dirname(src) or cwd
 * @returns {Promise<Bundle>}
 */
export async function loadBundle({ html, src, css, base }) {
  let raw = html;
  let url;
  let resolvedBase = base;

  if (!raw && src) {
    if (isRemote(src)) {
      raw = await (await fetch(src)).text();
      url = src;
      resolvedBase ??= process.cwd();
    } else {
      raw = await readFile(src, "utf8");
      url = pathToFileURL(path.resolve(src)).href;
      resolvedBase ??= path.dirname(path.resolve(src));
    }
  }
  resolvedBase ??= process.cwd();
  if (raw == null) throw new Error("No HTML source: pass { html } or { src }");

  const { document } = parseHTML(raw);

  // Collect CSS from three sources, in cascade order: linked sheets, inline <style>, explicit.
  const parts = [];
  const stylesheets = [];

  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute("href");
    if (!href) continue;
    stylesheets.push(href);
    const text = await readStyleHref(href, resolvedBase);
    if (text) parts.push(text);
  }

  for (const style of document.querySelectorAll("style")) {
    if (style.hasAttribute("data-critical")) continue; // ignore our own prior output
    parts.push(style.textContent || "");
  }

  for (const entry of await resolveExplicitCss(css, resolvedBase)) parts.push(entry);

  return {
    html: raw,
    document,
    css: parts.filter(Boolean).join("\n"),
    stylesheets,
    base: resolvedBase,
    url,
  };
}

async function readStyleHref(href, base) {
  try {
    if (isRemote(href)) return await (await fetch(href)).text();
    if (href.startsWith("//")) return await (await fetch(`https:${href}`)).text();
    // Root-relative or relative to the document/base
    const rel = href.replace(/^\//, "");
    return await readFile(path.resolve(base, rel), "utf8");
  } catch {
    return ""; // a missing/blocked sheet shouldn't abort the whole run
  }
}

async function resolveExplicitCss(css, base) {
  if (!css) return [];
  const list = Array.isArray(css) ? css : [css];
  const out = [];
  for (const entry of list) {
    if (looksLikeCss(entry)) {
      out.push(entry);
      continue;
    }
    if (isGlob(entry)) {
      for await (const file of glob(entry, { cwd: base })) {
        out.push(await readFile(path.resolve(base, file), "utf8"));
      }
      continue;
    }
    out.push(await readFile(path.resolve(base, entry), "utf8"));
  }
  return out;
}

export function isRemote(s) {
  return /^https?:\/\//i.test(s);
}
function isGlob(s) {
  return /[*?{}[\]]/.test(s);
}
function looksLikeCss(s) {
  return typeof s === "string" && /[{};]/.test(s) && !/\.css($|\?)/i.test(s);
}
