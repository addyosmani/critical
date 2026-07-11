/**
 * Inliner. Put the critical CSS in the document head as a <style>, and stop the full stylesheets
 * from blocking the first paint.
 *
 * We use the CSP-safe preload strategy instead of the old `media="print" onload="…"` swap: each
 * blocking <link rel="stylesheet"> in the head is replaced by a <link rel="preload" as="style">
 * (which starts the fetch early without blocking render) and the real stylesheet is moved to the
 * end of <body>. No inline event handler, so it works under a strict `script-src` policy. It also
 * needs no <noscript> fallback - the stylesheet still loads normally, just after the content.
 */

/**
 * @param {Document} document     linkedom document to mutate in place
 * @param {string} criticalCss    the inlined critical CSS
 * @param {object} [opts]
 * @param {boolean} [opts.preload=true] insert <link rel="preload"> hints for the moved sheets
 * @param {string}  [opts.nonce]        nonce to set on the injected <style> (strict style-src CSP)
 * @returns {{ stylesheets: string[] }} hrefs that were made non-blocking
 */
export function inlineCritical(document, criticalCss, { preload = true, nonce } = {}) {
  const head = document.head ?? document.querySelector("head");
  if (!head) throw new Error("Document has no <head> to inline into");

  // 1. Inject critical CSS first so it wins the cascade race against the deferred sheets.
  if (criticalCss.trim()) {
    const style = document.createElement("style");
    style.setAttribute("data-critical", "");
    if (nonce) style.setAttribute("nonce", nonce);
    style.textContent = criticalCss;
    head.insertBefore(style, head.firstChild);
  }

  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(
    (l) => !l.hasAttribute("data-critical-skip"),
  );
  if (links.length === 0) return { stylesheets: [] };

  const sink = document.body ?? document.querySelector("body") ?? head;
  const hrefs = [];

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    hrefs.push(href);

    // Replace the render-blocking <link> position in the head with a non-blocking preload hint...
    if (preload) {
      const pre = document.createElement("link");
      pre.setAttribute("rel", "preload");
      pre.setAttribute("as", "style");
      pre.setAttribute("href", href);
      carry(link, pre, "media");
      carry(link, pre, "crossorigin");
      link.parentNode?.insertBefore(pre, link);
    }

    // ...and move the real stylesheet to the end of the document so it applies after first paint.
    link.remove();
    sink.append(link);
  }

  return { stylesheets: hrefs };
}

function carry(from, to, attr) {
  if (from.hasAttribute(attr)) to.setAttribute(attr, from.getAttribute(attr));
}
