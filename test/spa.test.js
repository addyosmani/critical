/**
 * SPA tests — an empty shell that only becomes a page after JS runs, which a browser-free pass
 * has no markup to match against. These exercise the real render engine end-to-end (Playwright),
 * so they auto-skip when a browser isn't installed.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { critical } from "../src/index.js";
import { FIXTURES, ABOVE_FOLD, BELOW_FOLD, covers, hasPlaywright } from "../bench/lib.mjs";

const SPA = path.join(FIXTURES, "spa-app.html");
// Skips cleanly when no browser is installed; CI provisions Chrome so these run there.
const noBrowser = !(await hasPlaywright());

describe("SPA render engine", { skip: noBrowser && "requires Playwright" }, () => {
  let res;
  before(async () => {
    res = await critical({ src: SPA, engine: "auto" });
  });

  test("auto-routes the empty shell to the render engine", () => {
    assert.equal(res.report.engine, "render");
    assert.match(res.report.reason, /shell/i);
  });

  test("covers ALL above-the-fold selectors the app renders at runtime", () => {
    const got = covers(res.css, ABOVE_FOLD);
    assert.equal(
      got.length,
      ABOVE_FOLD.length,
      `missing: ${ABOVE_FOLD.filter((s) => !got.includes(s))}`,
    );
  });

  test("excludes below-the-fold selectors (viewport-aware, unlike used-CSS tools)", () => {
    assert.equal(covers(res.css, BELOW_FOLD).length, 0);
  });

  test("always keeps :root custom properties and the reset", () => {
    assert.match(res.css, /--brand/);
    assert.match(res.css, /box-sizing:border-box/);
  });

  test("inline mode injects critical <style> + defers the real sheet without inline JS", async () => {
    const { html, report } = await critical({ src: SPA, inline: true });
    assert.match(html, /<style data-critical/);
    assert.match(html, /rel="preload"/);
    assert.doesNotMatch(html, /onload=/);
    assert.deepEqual(report.stylesheetsDeferred, ["/app.css"]);
  });

  test("multiple viewports union their above-the-fold sets", async () => {
    const { css } = await critical({
      src: SPA,
      engine: "render",
      dimensions: [
        { width: 390, height: 844 }, // mobile
        { width: 1300, height: 900 }, // desktop
      ],
    });
    assert.equal(covers(css, ABOVE_FOLD).length, ABOVE_FOLD.length);
  });

  test("render output is deterministic across runs", async () => {
    const again = await critical({ src: SPA, engine: "render" });
    const baseline = await critical({ src: SPA, engine: "render" });
    assert.equal(again.css, baseline.css);
  });
});
