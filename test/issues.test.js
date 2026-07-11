/**
 * Issue regressions that live in the browser-free static path (deterministic, no Playwright).
 *
 *   #580 — modern CSS (@layer, @container, :where, :has) must pass through intact; Lightning CSS
 *          minifies without down-leveling, and the css-tree pruning recurses into grouping
 *          at-rules instead of dropping them.
 *   #613 — a custom property whose name starts with a digit (`--1x`) must survive parse + emit.
 *
 * Render-path regressions (#615 lazy iframes, #611 JS-injected stylesheets) are covered by the
 * spa/remote suites, which require a browser and skip when one isn't installed.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { critical } from "../src/index.js";

describe("issue regressions (static path)", () => {
  test("#580 — preserves @layer, @container, :where and :has", async () => {
    const html =
      "<!doctype html><html><head><style>" +
      "@layer base { .card { color: red } }" +
      "@container (min-width: 0px) { .card { color: blue } }" +
      ".card:where(.card) { outline: 1px solid }" +
      ".list:has(.item) { padding: 0 }" +
      "</style></head><body>" +
      '<section class="list"><article class="card"><h1>Modern CSS heading here</h1>' +
      '<span class="item">i</span></article></section>' +
      "</body></html>";

    const { css, report } = await critical({ html });
    assert.equal(report.engine, "static");
    assert.match(css, /@layer/);
    assert.match(css, /@container/);
    assert.match(css, /:where/);
    assert.match(css, /:has/);
  });

  test("#613 — writes output when a custom property name starts with a digit", async () => {
    const html =
      "<!doctype html><html><head><style>" +
      ":root{--1x:4px}" +
      ".card{width:var(--1x)}" +
      "</style></head><body>" +
      '<header class="card"><h1>Numeric custom property</h1></header>' +
      "<main><p>Real body content here.</p></main></body></html>";

    const { css, report } = await critical({ html });
    assert.equal(report.engine, "static");
    assert.match(css, /--1x:4px/);
    assert.match(css, /var\(--1x\)/);
  });
});
