/**
 * `css` option tests. The source loader merges extra CSS — raw strings, file paths, and globs,
 * or an array of those — on top of what the document links. Everything routes to the static
 * engine, so the extra rules only survive if their selectors match the delivered DOM; that
 * doubles as proof the CSS was actually ingested.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { critical } from "../src/index.js";

// Real markup (4 meaningful elements, >10 chars of text) so routing stays on the static engine.
const HTML =
  "<!doctype html><html><head></head><body>" +
  '<header class="hero"><h1>Above the fold title</h1></header>' +
  '<main><p class="lead">Body copy for the page.</p></main>' +
  "</body></html>";

async function tmp() {
  return mkdtemp(path.join(os.tmpdir(), "critical-css-"));
}

describe("css option", () => {
  test("accepts a raw CSS string alongside the document", async () => {
    const { css } = await critical({
      html: HTML,
      css: ".hero{color:red}.ghost{color:blue}",
    });
    assert.match(css, /\.hero/); // matches <header>, kept
    assert.doesNotMatch(css, /\.ghost/); // no matching element, dropped
  });

  test("reads a CSS file path (resolved against base)", async () => {
    const dir = await tmp();
    try {
      await writeFile(path.join(dir, "extra.css"), ".lead{font-weight:bold}");
      const { css } = await critical({ html: HTML, base: dir, css: "extra.css" });
      assert.match(css, /\.lead/);
      assert.match(css, /font-weight:(bold|700)/); // lightningcss normalizes bold -> 700
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("expands a glob into multiple stylesheets", async () => {
    const dir = await tmp();
    try {
      await writeFile(path.join(dir, "a.css"), ".hero{margin:0}");
      await writeFile(path.join(dir, "b.css"), ".lead{padding:0}");
      const { css } = await critical({ html: HTML, base: dir, css: "*.css" });
      assert.match(css, /\.hero/);
      assert.match(css, /\.lead/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("accepts an array mixing raw strings and file paths", async () => {
    const dir = await tmp();
    try {
      await writeFile(path.join(dir, "extra.css"), ".lead{color:green}");
      const { css } = await critical({
        html: HTML,
        base: dir,
        css: ["extra.css", ".hero{color:red}"],
      });
      assert.match(css, /\.lead/);
      assert.match(css, /\.hero/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("rebases relative url() refs in a nested CSS file to the base", async () => {
    const dir = await tmp();
    try {
      await mkdir(path.join(dir, "styles"));
      await writeFile(
        path.join(dir, "styles", "hero.css"),
        '.hero{background:url("../images/bg.png")}',
      );
      const { css } = await critical({ html: HTML, base: dir, css: "styles/hero.css" });
      // ../images/bg.png from styles/ becomes images/bg.png relative to the base dir.
      assert.match(css, /url\(["']?images\/bg\.png["']?\)/);
      assert.doesNotMatch(css, /\.\.\/images\/bg\.png/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
