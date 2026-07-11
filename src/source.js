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
import * as csstree from "css-tree";

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
    const { text, loc } = await loadStylesheet(href, resolvedBase, url);
    // Rebase relative url() refs so they still resolve once the CSS is inlined into the
    // document, which may sit in a different directory than the stylesheet did.
    if (text) parts.push(rebaseCss(text, loc, resolvedBase));
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

/**
 * Resolve a stylesheet href to a concrete location, keeping its provenance so url() refs can be
 * rebased later. Returns `{ url }` for anything fetched over the network or `{ file }` for a local
 * path, plus the loaded `text` ("" if missing/blocked - a bad sheet shouldn't abort the run).
 */
async function loadStylesheet(href, base, docUrl) {
  const loc = styleLocation(href, base, docUrl);
  const text = loc.url ? await fetchText(loc.url) : await readFileSafe(loc.file);
  return { text, loc };
}

function styleLocation(href, base, docUrl) {
  if (isRemote(href)) return { url: href };
  if (href.startsWith("//")) return { url: `https:${href}` };
  // A relative/root-relative href on a remotely-fetched document resolves against that URL.
  if (docUrl && isRemote(docUrl)) return { url: new URL(href, docUrl).href };
  // Local document: resolve root-relative or relative hrefs against the base directory.
  return { file: path.resolve(base, href.replace(/^\//, "")) };
}

// Leave alone anything that already resolves independently of the stylesheet's location:
// absolute URLs, protocol-relative, data:, in-document fragments, and root-relative paths.
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i;

/**
 * Rewrite relative url() references in a stylesheet so they resolve from the document that will
 * inline the CSS. For a remote stylesheet they become absolute URLs; for a local one they become
 * paths relative to the base directory (where the document lives).
 */
function rebaseCss(css, loc, base) {
  try {
    const ast = csstree.parse(css);
    let changed = false;
    csstree.walk(ast, {
      visit: "Url",
      enter(node) {
        const value = node.value;
        if (!value || ABSOLUTE_URL.test(value)) return;
        const rebased = loc.url
          ? new URL(value, loc.url).href
          : toPosix(path.relative(base, path.resolve(path.dirname(loc.file), value)));
        if (rebased && rebased !== value) {
          node.value = rebased;
          changed = true;
        }
      },
    });
    return changed ? csstree.generate(ast) : css;
  } catch {
    return css; // never let a rebase pass break an otherwise-valid stylesheet
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function readFileSafe(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url);
    return res.ok ? res.text() : "";
  } catch {
    return "";
  }
}

async function resolveExplicitCss(css, base) {
  if (!css) return [];
  const list = Array.isArray(css) ? css : [css];
  const out = [];
  for (const entry of list) {
    if (looksLikeCss(entry)) {
      out.push(entry); // raw CSS string: no path to rebase against
      continue;
    }
    if (isGlob(entry)) {
      for await (const file of glob(entry, { cwd: base })) {
        const abs = path.resolve(base, file);
        out.push(rebaseCss(await readFileSafe(abs), { file: abs }, base));
      }
      continue;
    }
    const abs = path.resolve(base, entry);
    out.push(rebaseCss(await readFileSafe(abs), { file: abs }, base));
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
