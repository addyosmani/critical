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

test("inline injects critical <style> and defers the stylesheet without inline JS", async () => {
  const { html, report } = await critical({
    src: path.join(fixtures, "index.html"),
    inline: true,
  });
  assert.match(html, /<style data-critical/);
  assert.match(html, /rel="preload"/); // non-blocking preload hint in the head
  assert.match(html, /as="style"/);
  assert.doesNotMatch(html, /onload=/); // no inline event handler -> strict-CSP safe
  assert.deepEqual(report.stylesheetsDeferred, ["/styles.css"]);
});

test("inline accepts a nonce for the critical <style> (strict style-src CSP)", async () => {
  const { html } = await critical({
    src: path.join(fixtures, "index.html"),
    inline: { nonce: "r4nd0m" },
  });
  assert.match(html, /<style[^>]*nonce="r4nd0m"/);
});

test("deterministic output: identical input -> identical bytes", async () => {
  const a = await critical({ src: path.join(fixtures, "index.html") });
  const b = await critical({ src: path.join(fixtures, "index.html") });
  assert.equal(a.css, b.css);
});

test("rebases relative url() refs from a nested stylesheet to the document", async () => {
  const { css } = await critical({ src: path.join(fixtures, "rebase", "index.html") });
  // styles/hero.css is one level down; ../images/hero.png must become images/hero.png so it
  // still resolves once inlined into the root index.html.
  assert.match(css, /url\(["']?images\/hero\.png["']?\)/);
  assert.doesNotMatch(css, /\.\.\/images\/hero\.png/);
  // root-relative and absolute URLs resolve independently of the stylesheet, so leave them alone
  assert.match(css, /\/img\/border\.png/);
  assert.match(css, /cdn\.test\/cur\.png/);
});
