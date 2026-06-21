/**
 * Inliner. Put the critical CSS in the document head as a <style>, and turn the now-non-blocking
 * stylesheet <link>s into asynchronous loads with a <noscript> fallback.
 *
 * The async pattern is the 2026-stable one: `media="print" onload="this.media='all'"`. It needs
 * no loadCSS polyfill (which v8 carried) and degrades safely — if anything goes wrong the
 * <noscript> copy loads every stylesheet the normal, blocking way. A broken run yields a slightly
 * slower page, never an unstyled one.
 */

/**
 * @param {Document} document     linkedom document to mutate in place
 * @param {string} criticalCss    the inlined critical CSS
 * @param {object} [opts]
 * @param {boolean} [opts.async=true]   convert blocking links to async loads
 * @param {boolean} [opts.preload=true] add <link rel=preload> hints for the deferred sheets
 * @returns {{ stylesheets: string[] }} hrefs that were made non-blocking
 */
export function inlineCritical(document, criticalCss, { async = true, preload = true } = {}) {
  const head = document.head ?? document.querySelector("head");
  if (!head) throw new Error("Document has no <head> to inline into");

  // 1. Inject critical CSS first so it wins the cascade race against the async sheets.
  if (criticalCss.trim()) {
    const style = document.createElement("style");
    style.setAttribute("data-critical", "");
    style.textContent = criticalCss;
    head.insertBefore(style, head.firstChild);
  }

  if (!async) return { stylesheets: [] };

  // 2. Defer the real stylesheets.
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(
    (l) => !l.hasAttribute("data-critical-skip"),
  );
  const fallback = [];
  const hrefs = [];

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    hrefs.push(href);

    // Preserve the blocking version inside <noscript> for the JS-disabled / failure path.
    fallback.push(link.outerHTML);

    if (preload) {
      const pre = document.createElement("link");
      pre.setAttribute("rel", "preload");
      pre.setAttribute("as", "style");
      pre.setAttribute("href", href);
      link.parentNode.insertBefore(pre, link);
    }

    link.setAttribute("media", "print");
    link.setAttribute("onload", "this.media='all'; this.onload=null;");
  }

  if (fallback.length) {
    const noscript = document.createElement("noscript");
    noscript.innerHTML = fallback.join("");
    // Place the fallback after the last deferred link.
    const lastLink = links.at(-1);
    lastLink.parentNode.insertBefore(noscript, lastLink.nextSibling);
  }

  return { stylesheets: hrefs };
}
