/**
 * API-surface + report-shape tests for critical(). Covers input precedence (html over src),
 * the deterministic minify toggle, engine pinning, and every field the structured report
 * promises — the contract agents and CI assert against. All static; no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { critical } from "../src/index.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const INDEX = path.join(fixtures, "index.html");

const HTML =
  "<!doctype html><html><head><style>.hero{color:red}.dead{color:blue}</style></head><body>" +
  '<header class="hero"><h1>Above the fold heading</h1></header>' +
  "<main><p>Rendered body content here.</p></main></body></html>";

describe("critical() API", () => {
  test("html takes precedence over src", async () => {
    // src points at a real file, but html is provided too -> html wins.
    const { css } = await critical({ html: HTML, src: INDEX });
    assert.match(css, /\.hero/);
    assert.doesNotMatch(css, /\.dead/); // proves our inline HTML (not index.html) was used
  });

  test("throws when neither html nor src is given", async () => {
    await assert.rejects(() => critical({}), /No HTML source/);
  });

  test("engine can be pinned explicitly", async () => {
    const { report } = await critical({ html: HTML, engine: "static" });
    assert.equal(report.engine, "static");
    assert.equal(report.requestedEngine, "static");
    assert.match(report.reason, /pinned/);
  });

  test("requestedEngine records the caller's choice even under auto", async () => {
    const { report } = await critical({ html: HTML });
    assert.equal(report.requestedEngine, "auto");
    assert.equal(report.engine, "static"); // auto resolved to static
  });

  test("minify:false yields readable CSS, minify:true collapses it", async () => {
    const min = await critical({ html: HTML, minify: true });
    const readable = await critical({ html: HTML, minify: false });
    assert.ok(readable.css.length > min.css.length);
    assert.match(readable.css, /\n/);
    assert.doesNotMatch(min.css, /\n\s/);
  });

  test("base resolves the document's root-relative stylesheet", async () => {
    // The fixture links /styles.css; base = fixtures dir so it resolves off disk.
    const { css, report } = await critical({ src: INDEX });
    assert.ok(report.bytes.stylesheets > 0);
    assert.match(css, /\.hero/);
  });
});

describe("report shape", () => {
  test("exposes every documented field with sane values", async () => {
    const { report } = await critical({ src: INDEX });

    assert.equal(typeof report.engine, "string");
    assert.equal(typeof report.reason, "string");
    assert.equal(report.requestedEngine, "auto");

    assert.equal(typeof report.rules.kept, "number");
    assert.equal(typeof report.rules.total, "number");
    assert.ok(report.rules.kept <= report.rules.total);

    assert.ok(report.bytes.stylesheets > 0);
    assert.ok(report.bytes.critical > 0);
    assert.equal(report.bytes.savedBlocking, 0); // no inline -> nothing un-blocked

    assert.deepEqual(report.stylesheetsDiscovered, ["/styles.css"]);
    assert.ok(Array.isArray(report.warnings));
    assert.equal(typeof report.durationMs, "number");
    assert.equal(report.deterministic, true);
  });

  test("savedBlocking equals stylesheet bytes once inlined", async () => {
    const { report } = await critical({ src: INDEX, inline: true });
    assert.equal(report.savedBlocking ?? report.bytes.savedBlocking, report.bytes.stylesheets);
    assert.deepEqual(report.stylesheetsDeferred, ["/styles.css"]);
  });
});
