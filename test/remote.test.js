/**
 * Remote-source tests (render engine over HTTP). Regression guards for two bugs caught in review:
 *   1. The render engine must navigate to the document URL so the browser fetches and runs
 *      external/module scripts and relative assets - setContent with no base cannot.
 *   2. The source loader must resolve a relative stylesheet against the *remote* document URL and
 *      fetch it, not look for it on the local filesystem.
 *
 * Serves the fixtures over a throwaway HTTP server so both paths are exercised end to end.
 * Auto-skips when Playwright isn't installed.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { critical } from "../src/index.js";
import { FIXTURES, ABOVE_FOLD, covers, hasPlaywright } from "../bench/lib.mjs";

const noBrowser = !(await hasPlaywright());
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

describe("remote src over HTTP", { skip: noBrowser && "requires Playwright" }, () => {
  let server;
  let res;

  before(async () => {
    server = http.createServer(async (req, response) => {
      try {
        const rel = decodeURI(req.url.split("?")[0]).replace(/^\//, "");
        const file = path.join(FIXTURES, rel);
        const body = await readFile(file);
        response.setHeader("content-type", TYPES[path.extname(file)] ?? "application/octet-stream");
        response.end(body);
      } catch {
        response.statusCode = 404;
        response.end("not found");
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    res = await critical({ src: `${base}/spa-external.html`, engine: "render" });
  });

  after(() => server?.close());

  test("renders an SPA whose UI comes from an external module script", () => {
    // If the browser never loaded /spa-external.js, #root stays empty and coverage is 0.
    assert.equal(res.report.engine, "render");
    assert.equal(
      covers(res.css, ABOVE_FOLD).length,
      ABOVE_FOLD.length,
      "external module script did not render into the shell",
    );
  });

  test("resolves a relative stylesheet against the remote document URL", () => {
    // bundle CSS comes only from the source loader. If the relative <link href="app.css"> were
    // looked up on local disk instead of fetched from the server, this would be 0 bytes.
    assert.ok(
      res.report.bytes.stylesheets > 0,
      "relative stylesheet was not fetched from the server",
    );
    assert.match(res.css, /\.hero/);
  });
});
