/**
 * CLI tests. Exercises cli.js end to end as a child process: help, file/stdin/dir input,
 * --inline, --json, --explain, --no-minify, -e, --out, and the non-zero exit on bad input.
 * Everything here routes to the static engine (or short-circuits), so no browser is required.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "cli.js");
const fixtures = path.join(root, "fixtures");

// A self-contained static document: inline CSS, real markup, one used + one unused rule.
// Enough elements/text that routing picks the static engine (never boots a browser).
const STATIC_HTML =
  "<!doctype html><html><head><style>.box{color:red}.unused{color:blue}</style></head>" +
  '<body><header class="box"><h1>Above the fold heading</h1></header>' +
  "<main><p>Real rendered content lives here.</p></main></body></html>";

function run(args, { stdin, cwd = root } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    if (stdin != null) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

describe("CLI", () => {
  test("--help prints usage and exits 0", async () => {
    const { code, stdout } = await run(["--help"]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage/);
    assert.match(stdout, /critical <input>/);
  });

  test("a file argument prints critical CSS to stdout", async () => {
    const { code, stdout } = await run([path.join(fixtures, "index.html")]);
    assert.equal(code, 0);
    assert.match(stdout, /\.hero/);
    assert.doesNotMatch(stdout, /\.footer/); // unused selector dropped
  });

  test("--inline emits the document with an injected critical <style>", async () => {
    const { code, stdout } = await run([path.join(fixtures, "index.html"), "--inline"]);
    assert.equal(code, 0);
    assert.match(stdout, /<style data-critical/);
    assert.match(stdout, /rel="preload"/); // stylesheet deferred via preload hint
  });

  test("--json emits the structured report", async () => {
    const { code, stdout } = await run([path.join(fixtures, "index.html"), "--json"]);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.engine, "static");
    assert.equal(report.input, path.join(fixtures, "index.html"));
    assert.ok(report.bytes.critical > 0);
  });

  test("--explain writes the routing decision to stderr, not stdout", async () => {
    const { code, stdout, stderr } = await run([path.join(fixtures, "index.html"), "--explain"]);
    assert.equal(code, 0);
    assert.match(stderr, /static/);
    assert.equal(stdout, ""); // explain suppresses the stdout payload
  });

  test("-e static pins the engine", async () => {
    const { code, stdout } = await run([
      path.join(fixtures, "index.html"),
      "-e",
      "static",
      "--json",
    ]);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.engine, "static");
    assert.match(report.reason, /pinned/);
  });

  test("--no-minify keeps the critical CSS readable", async () => {
    const min = await run([path.join(fixtures, "index.html")]);
    const readable = await run([path.join(fixtures, "index.html"), "--no-minify"]);
    assert.equal(readable.code, 0);
    assert.ok(readable.stdout.length >= min.stdout.length);
    assert.match(readable.stdout, /\{\n/); // pretty-printed blocks
  });

  test("reads HTML from stdin when no positional is given", async () => {
    const { code, stdout } = await run(["--json"], { stdin: STATIC_HTML });
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.input, "<stdin>");
    assert.equal(report.engine, "static");
  });

  test("stdin payload keeps used rules and drops unused ones", async () => {
    const { code, stdout } = await run([], { stdin: STATIC_HTML });
    assert.equal(code, 0);
    assert.match(stdout, /\.box/);
    assert.doesNotMatch(stdout, /\.unused/);
  });

  test("a directory input processes every *.html it finds", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "critical-cli-"));
    try {
      await writeFile(path.join(dir, "a.html"), STATIC_HTML);
      await writeFile(path.join(dir, "b.html"), STATIC_HTML);
      const { code, stdout } = await run([dir]);
      assert.equal(code, 0);
      // both files produce critical CSS -> the selector appears once per file
      assert.equal(stdout.match(/\.box/g)?.length, 2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("--out writes the payload to a file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "critical-cli-"));
    try {
      const out = path.join(dir, "critical.css");
      const { code } = await run([path.join(fixtures, "index.html"), "-o", out]);
      assert.equal(code, 0);
      const written = await readFile(out, "utf8");
      assert.match(written, /\.hero/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("--write --inline rewrites the input file in place", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "critical-cli-"));
    try {
      const file = path.join(dir, "page.html");
      await writeFile(file, STATIC_HTML);
      const { code } = await run([file, "--inline", "--write"]);
      assert.equal(code, 0);
      const rewritten = await readFile(file, "utf8");
      assert.match(rewritten, /<style data-critical/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("exits 1 with an error on a non-existent input", async () => {
    const { code, stderr } = await run([path.join(fixtures, "does-not-exist.html")]);
    assert.equal(code, 1);
    assert.match(stderr, /Error/);
  });
});
