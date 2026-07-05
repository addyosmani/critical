/**
 * Source-loader regressions for behaviors v8 supported that were missing in the v9 rewrite:
 *
 *   - query/hash on a stylesheet href (`styles.css?v=2`) must resolve to the file on disk
 *   - data: URI stylesheets (base64 and percent-encoded) must be decoded inline
 *   - a document <base href> must re-point relative stylesheet resolution (issue #566)
 *
 * All static — no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { critical } from "../src/index.js";

const BODY =
  '<body><header class="hero"><h1>Above the fold heading</h1></header>' +
  "<main><p>Rendered body content here.</p></main></body>";

async function tmp() {
  return mkdtemp(path.join(os.tmpdir(), "critical-src-"));
}

describe("stylesheet href resolution", () => {
  test("resolves a href carrying a ?query string to the file on disk", async () => {
    const dir = await tmp();
    try {
      await writeFile(path.join(dir, "styles.css"), ".hero{color:red}");
      const { css, report } = await critical({
        html: `<!doctype html><html><head><link rel="stylesheet" href="/styles.css?v=2"></head>${BODY}</html>`,
        base: dir,
      });
      assert.ok(report.bytes.stylesheets > 0, "query-string href should still load the file");
      assert.match(css, /\.hero/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("resolves a href with a #fragment", async () => {
    const dir = await tmp();
    try {
      await writeFile(path.join(dir, "styles.css"), ".hero{color:red}");
      const { css } = await critical({
        html: `<!doctype html><html><head><link rel="stylesheet" href="styles.css#x"></head>${BODY}</html>`,
        base: dir,
      });
      assert.match(css, /\.hero/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("data: URI stylesheets", () => {
  test("decodes a base64 data URI", async () => {
    const uri = "data:text/css;base64," + Buffer.from(".hero{color:green}").toString("base64");
    const { css, report } = await critical({
      html: `<!doctype html><html><head><link rel="stylesheet" href="${uri}"></head>${BODY}</html>`,
    });
    assert.ok(report.bytes.stylesheets > 0);
    assert.match(css, /\.hero/);
  });

  test("decodes a percent-encoded data URI", async () => {
    const uri = "data:text/css," + encodeURIComponent(".hero{color:orange}");
    const { css } = await critical({
      html: `<!doctype html><html><head><link rel="stylesheet" href="${uri}"></head>${BODY}</html>`,
    });
    assert.match(css, /\.hero/);
  });
});

describe("document <base href> (#566)", () => {
  test("a path-style base href prefixes relative stylesheet hrefs", async () => {
    const dir = await tmp();
    try {
      await mkdir(path.join(dir, "assets"));
      await writeFile(path.join(dir, "assets", "app.css"), ".hero{color:teal}");
      const { css, report } = await critical({
        html: `<!doctype html><html><head><base href="/assets/"><link rel="stylesheet" href="app.css"></head>${BODY}</html>`,
        base: dir,
      });
      assert.ok(report.bytes.stylesheets > 0, "base href should redirect resolution into assets/");
      assert.match(css, /\.hero/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("an absolute base href resolves relative sheets against it", async () => {
    const dir = await tmp();
    try {
      // Only a local file matching the *unprefixed* href exists. If the absolute base href were
      // honored, resolution would point at a remote URL and this local file would NOT be read —
      // so the sheet must come back empty, proving the base host took precedence.
      await writeFile(path.join(dir, "app.css"), ".hero{color:red}");
      const { report } = await critical({
        html: `<!doctype html><html><head><base href="https://cdn.example.test/"><link rel="stylesheet" href="app.css"></head>${BODY}</html>`,
        base: dir,
      });
      // The remote fetch fails (no such host in test), so bytes are 0 — but crucially the local
      // app.css was NOT picked up, confirming the absolute base href redirected resolution.
      assert.equal(report.bytes.stylesheets, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
