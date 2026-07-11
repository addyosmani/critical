/**
 * foldAware + warning-path tests for the static engine.
 *
 * A `[data-critical-fold]` container scopes matching to the above-the-fold subtree, so rules
 * used only below it are dropped. Turning that off (foldAware:false / --no-fold) falls back to
 * whole-document "used CSS" and surfaces a warning. A document with no CSS short-circuits to
 * engine "none". All static — no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { critical } from "../src/index.js";

// A fold container wrapping the hero; the footer sits below the fold.
const FOLD_HTML =
  "<!doctype html><html><head><style>.in{color:red}.out{color:blue}</style></head><body>" +
  '<div data-critical-fold><header class="in"><h1>Visible hero content</h1></header></div>' +
  '<footer class="out"><p>Below-the-fold footer text.</p></footer>' +
  "</body></html>";

// Same markup, no fold hint — a plain rendered page.
const PLAIN_HTML =
  "<!doctype html><html><head><style>.a{color:red}</style></head><body>" +
  '<header class="a"><h1>Above the fold heading</h1></header>' +
  "<main><p>Rendered body content here.</p></main></body></html>";

describe("foldAware", () => {
  test("scopes matching to the fold container and drops below-fold rules", async () => {
    const { css, report } = await critical({ html: FOLD_HTML });
    assert.equal(report.engine, "static");
    assert.match(css, /\.in/); // inside the fold, kept
    assert.doesNotMatch(css, /\.out/); // below the fold, dropped
    assert.ok(report.rules.kept < report.rules.total);
    // fold-scoped output is not the "used CSS superset" — no such warning
    assert.ok(!report.warnings.some((w) => /superset of above-the-fold/.test(w)));
  });

  test("foldAware:false ignores the fold hint and keeps all used CSS", async () => {
    const { css, report } = await critical({ html: FOLD_HTML, foldAware: false });
    assert.match(css, /\.in/);
    assert.match(css, /\.out/); // fold ignored -> below-fold rule kept
    assert.ok(
      report.warnings.some((w) => /superset of above-the-fold/.test(w)),
      "expected the used-CSS superset warning",
    );
  });

  test("a page with no fold hint warns that output is a used-CSS superset", async () => {
    const { report } = await critical({ html: PLAIN_HTML });
    assert.equal(report.engine, "static");
    assert.ok(report.warnings.some((w) => /superset of above-the-fold/.test(w)));
  });
});

describe("no-CSS short-circuit", () => {
  test('a document with no stylesheets resolves to engine "none"', async () => {
    const { css, html, report } = await critical({
      html:
        "<!doctype html><html><body><header><h1>Content with no styles</h1></header>" +
        "<main><p>Nothing to extract here.</p></main></body></html>",
    });
    assert.equal(report.engine, "none");
    assert.equal(css, "");
    assert.match(html, /<h1>Content with no styles<\/h1>/); // html passes through untouched
    assert.ok(report.warnings.some((w) => /No CSS found/.test(w)));
    assert.equal(report.rules.total, 0);
  });
});
