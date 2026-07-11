/**
 * CSS layer. Two responsibilities, two libraries, zero overlap:
 *   - css-tree     parses + walks rules so we can test each selector against a DOM
 *   - lightningcss does the final minify / dedupe / dead-code pass (the Rust core that
 *                  replaces clean-css + postcss + cssnano + postcss-discard from v8)
 */
import { Buffer } from "node:buffer";
import * as csstree from "css-tree";
import { transform } from "lightningcss";

/**
 * Minify + normalize a CSS string through Lightning CSS.
 * Deterministic output: same input -> byte-identical bytes out.
 * @param {string} css
 * @param {object} [opts]
 * @param {boolean} [opts.minify=true]
 * @returns {string}
 */
export function finalize(css, { minify = true } = {}) {
  if (!css.trim()) return "";
  const { code } = transform({
    filename: "critical.css",
    code: Buffer.from(css),
    minify,
    // errorRecovery so one malformed upstream rule can't sink the whole build
    errorRecovery: true,
  });
  return code.toString();
}

/**
 * Walk a stylesheet and decide, rule by rule, whether to keep it.
 *
 * `keepSelector(selector)` returns true if a selector matches the delivered DOM.
 * At-rules that hold nested rules (`@media`, `@supports`, `@layer`, `@container`) are
 * recursed into and dropped only when they end up empty. Unconditionally-critical
 * at-rules (`@font-face`, `@keyframes`, custom-property `@property`, `@import`) are kept
 * when referenced — here we keep `@font-face`/`@property` only if their owning context
 * survived, matching what a browser would actually need for first paint.
 *
 * @param {string} css raw stylesheet text
 * @param {(selectorText: string) => boolean} keepSelector
 * @returns {{ css: string, kept: number, total: number }}
 */
export function extractUsed(css, keepSelector) {
  const ast = csstree.parse(css, { positions: false });
  let total = 0;
  let kept = 0;

  // Track keyframe/animation names so we keep @keyframes only when referenced by a
  // surviving rule. Two-pass: first collect survivors, then prune unused keyframes.
  const usedAnimations = new Set();

  csstree.walk(ast, {
    visit: "Rule",
    enter(node, item, list) {
      // Skip rules inside @keyframes: css-tree parses keyframe selectors (`to`, `50%`) as a
      // SelectorList too, so without this guard `to` is treated as a type selector, fails to
      // match the DOM, and the whole animation body is deleted.
      if (this.atrule && /keyframes$/i.test(this.atrule.name)) return;
      if (node.prelude?.type !== "SelectorList") return;
      total += 1;

      const selectors = node.prelude.children.toArray();
      const survivors = selectors.filter((sel) => {
        const text = csstree.generate(sel);
        return safeKeep(keepSelector, text);
      });

      if (survivors.length === 0) {
        list.remove(item);
        return;
      }

      kept += 1;
      // Rewrite prelude to only the selectors that matched (shrinks output)
      node.prelude.children.fromArray(survivors);

      // Note any animation-name this surviving rule depends on
      csstree.walk(node.block, {
        visit: "Declaration",
        enter(decl) {
          if (/^(-\w+-)?animation(-name)?$/i.test(decl.property)) {
            collectAnimationNames(decl.value, usedAnimations);
          }
        },
      });
    },
  });

  // Drop @keyframes nobody animates, and empty conditional groups left behind.
  csstree.walk(ast, {
    visit: "Atrule",
    enter(node, item, list) {
      const name = node.name.toLowerCase();
      if (name === "keyframes" || name.endsWith("keyframes")) {
        const kf = node.prelude && csstree.generate(node.prelude).trim();
        if (kf && !usedAnimations.has(kf)) list.remove(item);
        return;
      }
      // Empty @media/@supports/@layer/@container -> remove
      if (node.block && node.block.children.isEmpty) list.remove(item);
    },
  });

  return { css: csstree.generate(ast), kept, total };
}

function safeKeep(keepSelector, text) {
  try {
    return keepSelector(text);
  } catch {
    // An unsupported/exotic selector (e.g. ::part, :has() in an old matcher) is kept
    // rather than silently dropped — conservative beats a missing-style flash.
    return true;
  }
}

function collectAnimationNames(value, into) {
  csstree.walk(value, {
    visit: "Identifier",
    enter(id) {
      // crude but effective: animation shorthand idents that aren't keywords/timings
      if (
        !/^(none|infinite|alternate|normal|reverse|forwards|backwards|both|paused|running|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i.test(
          id.name,
        )
      ) {
        into.add(id.name);
      }
    },
  });
}
