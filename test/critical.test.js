import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { critical } from "../src/index.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

test("auto-routes a fully-rendered page to the static engine", async () => {
  const { css, report } = await critical({ src: path.join(fixtures, "index.html") });
  assert.equal(report.engine, "static");

  // keeps used selectors
  assert.match(css, /\.hero/);
  assert.match(css, /\.nav/);
  assert.match(css, /\.spinner/);

  // keeps the referenced @keyframes WITH its body, drops the unreferenced one
  assert.match(css, /@keyframes spin\{to\{transform:rotate\(360deg\)\}\}/);
  assert.doesNotMatch(css, /@keyframes pulse/);

  // drops selectors with no matching element
  assert.doesNotMatch(css, /\.footer/);
  assert.doesNotMatch(css, /\.modal/);
  assert.doesNotMatch(css, /\.pricing-table/);

  // critical CSS is a real subset of the source
  assert.ok(report.bytes.critical < report.bytes.stylesheets);
  assert.ok(report.rules.kept < report.rules.total);
});

// Full SPA render-engine coverage lives in test/spa.test.js. Here we only assert the routing
// decision, which is pure and needs no browser.
test("routing decision: SPA shell is detected without launching a browser", async () => {
  const { routeEngine } = await import("../src/detect.js");
  const { parseHTML } = await import("linkedom");
  const { document } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
  const routed = routeEngine(document);
  assert.equal(routed.engine, "render");
});

test("inline injects critical <style> and defers the stylesheet", async () => {
  const { html, report } = await critical({
    src: path.join(fixtures, "index.html"),
    inline: true,
  });
  assert.match(html, /<style data-critical/);
  assert.match(html, /media="print"/); // link deferred
  assert.match(html, /<noscript>/); // safe fallback present
  assert.deepEqual(report.stylesheetsDeferred, ["/styles.css"]);
});

test("deterministic output: identical input -> identical bytes", async () => {
  const a = await critical({ src: path.join(fixtures, "index.html") });
  const b = await critical({ src: path.join(fixtures, "index.html") });
  assert.equal(a.css, b.css);
});
