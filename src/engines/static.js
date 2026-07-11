/**
 * Static engine — the fast path. No browser. Match each CSS rule against the delivered DOM
 * and keep the ones that are used. This is the Critters/Beasties lineage, with two upgrades:
 *
 *   1. A fold scope. Beasties inlines *all* used CSS. If the document (or the author, via
 *      `data-critical-fold`) gives us a hint of what's above the fold, we match only inside
 *      that subtree, shrinking the inlined set toward what the render engine would produce.
 *   2. Keyframe/animation-aware pruning lives in css.js so we don't ship dead @keyframes.
 */
import { extractUsed } from "../css.js";

const ALWAYS_MATCH = new Set([":root", "html", "body", "*", "::before", "::after"]);

/**
 * @param {Document} document  linkedom document of the delivered HTML
 * @param {string} css         combined stylesheet text
 * @param {object} [opts]
 * @param {boolean} [opts.foldAware=true]  honor data-critical-fold scoping when present
 * @returns {{ css: string, kept: number, total: number, foldScoped: boolean }}
 */
export function runStatic(document, css, { foldAware = true } = {}) {
  const foldRoot = foldAware ? document.querySelector("[data-critical-fold]") : null;
  const scope = foldRoot ?? document;

  const cache = new Map();
  const keepSelector = (selectorText) => {
    const probe = normalizeForMatch(selectorText);
    if (ALWAYS_MATCH.has(probe)) return true;
    if (cache.has(probe)) return cache.get(probe);

    let matches = false;
    try {
      // Scope match: does any element in the (fold) subtree match this selector?
      matches = scope.querySelector(probe) != null;
      // Fold roots match against descendants; also let the root element itself match
      if (!matches && foldRoot && elementMatches(foldRoot, probe)) matches = true;
    } catch {
      matches = true; // unknown selector -> keep, never risk a missing-style flash
    }
    cache.set(probe, matches);
    return matches;
  };

  const { css: out, kept, total } = extractUsed(css, keepSelector);
  return { css: out, kept, total, foldScoped: Boolean(foldRoot) };
}

/**
 * Strip pseudo-elements/-classes that can't be evaluated against a static DOM but don't
 * change whether the *base* selector is present (e.g. `a:hover` -> `a`, `li::marker` -> `li`).
 * Keeps structural pseudos (:not, :is, :where, :has, nth-*) intact for accuracy.
 */
function normalizeForMatch(selector) {
  return (
    selector
      .replace(
        /::?(hover|active|focus(-within|-visible)?|visited|link|target|checked|disabled|enabled|placeholder-shown|first-line|first-letter|before|after|marker|selection|backdrop|placeholder|file-selector-button)\b(\([^)]*\))?/gi,
        "",
      )
      .replace(/\s+/g, " ")
      .trim() || "*"
  );
}

function elementMatches(el, selector) {
  try {
    return el.matches?.(selector) ?? false;
  } catch {
    return false;
  }
}
