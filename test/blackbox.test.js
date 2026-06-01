import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import fs from "node:fs";
import { vi } from "vitest";
import getPort from "get-port";
import Vinyl from "vinyl";
import nock from "nock";
import async from "async";
import finalhandler from "finalhandler";
import serveStatic from "serve-static";
import nn from "normalize-newline";
import { generate } from "../index.js";
import { read, readAndRemove } from "./helper/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "/fixtures/");

function assertCritical(target, expected, resolve, reject, skipTarget) {
  return (err, { css, html } = {}) => {
    const output = target.endsWith(".css") ? css : html;

    if (err) {
      console.log(err);
      reject(err);
      return;
    }

    try {
      expect(err).toBeFalsy();
      expect(output).toBeDefined();
      if (!skipTarget) {
        const dest = readAndRemove(target);
        expect(dest).toBe(expected);
      }

      expect(nn(output)).toBe(expected);
    } catch (error) {
      reject(error);
      return;
    }

    resolve();
  };
}

// Setup static fileserver to mimic remote requests
let server;
let port;
beforeAll(async () => {
  const serve = serveStatic(path.join(__dirname, "fixtures"), {
    index: ["index.html", "index.htm"],
  });
  const serveUserAgent = serveStatic(path.join(__dirname, "fixtures/useragent"), {
    index: ["index.html", "index.htm"],
  });

  port = await getPort();

  server = createServer((req, res) => {
    if (req.headers["user-agent"] === "custom agent") {
      return serveUserAgent(req, res, finalhandler(req, res));
    }

    serve(req, res, finalhandler(req, res));
  }).listen(port);
});

afterAll(() => server.close());

// Prepare stderr mock
let stderr;
beforeEach(() => {
  stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  stderr.mockRestore();
});

describe("generate (local)", () => {
  test("generate critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css");
      const target = path.resolve(".critical.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default.html",
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("generate critical-path CSS from CSS files passed as Vinyl objects", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css");
      const target = path.resolve(".critical.css");
      const stylesheets = ["fixtures/styles/main.css", "fixtures/styles/bootstrap.css"].map(
        (filePath) => {
          return new Vinyl({
            cwd: "/",
            base: "/fixtures/",
            path: filePath,
            contents: Buffer.from(fs.readFileSync(path.join(__dirname, filePath), "utf8"), "utf8"),
          });
        },
      );

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-nostyle.html",
          target,
          css: stylesheets,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should throw an error on timeout", () => {
    return new Promise((resolve, _reject) => {
      const target = path.join(__dirname, ".include.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default.html",
          penthouse: {
            timeout: 1,
          },
          target,
          width: 1300,
          height: 900,
        },
        (err) => {
          expect(err).toBeInstanceOf(Error);
          resolve();
        },
      );
    });
  });

  test("should throw a usable error when no stylesheets are found", () => {
    return new Promise((resolve, _reject) => {
      const target = path.join(__dirname, ".error.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "error.html",
          penthouse: {
            timeout: 1,
          },
          target,
          width: 1300,
          height: 900,
        },
        (err) => {
          expect(err).toBeInstanceOf(Error);
          fs.promises.unlink(target).then(() => resolve());
        },
      );
    });
  });

  test("should generate critical-path CSS with query string in file name", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css");
      const target = path.resolve(".critical.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-querystring.html",
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should ignore stylesheets blocked due to 403", () => {
    return new Promise((resolve, reject) => {
      const expected = "";
      const target = path.resolve(".403.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "403-css.html",
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should ignore stylesheets blocked due to 404", () => {
    return new Promise((resolve, reject) => {
      const expected = "";
      const target = path.resolve(".404.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "404-css.html",
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate multi-dimension critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-adaptive.css", "utf8");
      const target = path.resolve(".adaptive.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-adaptive.html",
          target,
          dimensions: [
            {
              width: 100,
              height: 70,
            },
            {
              width: 1000,
              height: 70,
            },
          ],
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should consider inline styles", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-adaptive.css", "utf8");
      const target = path.resolve(".adaptive-inline.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-adaptive-inline.html",
          target,
          dimensions: [
            {
              width: 100,
              height: 70,
            },
            {
              width: 1000,
              height: 70,
            },
          ],
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should consider data uris in stylesheet hrefs", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-adaptive.css", "utf8");
      const target = path.resolve(".adaptive-base64.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-adaptive-base64.html",
          target,
          dimensions: [
            {
              width: 100,
              height: 70,
            },
            {
              width: 1000,
              height: 70,
            },
          ],
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate minified critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.resolve(".critical.min.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default.html",
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate minified critical-path CSS successfully with external css file configured", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.resolve(".nostyle.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-nostyle.html",
          css: ["fixtures/styles/main.css", "fixtures/styles/bootstrap.css"],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should evaluate css passed as source string", () => {
    return new Promise((resolve, reject) => {
      const expected = "html{display:block}";
      const target = path.resolve(".source-string.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-nostyle.html",
          css: ["html{display:block}.someclass{color:red}"],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline relative images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.resolve(".image-relative.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/image-relative.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline relative images from folder", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.resolve(".image-relative.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "folder/generate-image.html",
          css: ["fixtures/styles/image-relative.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should rewrite relative images for html outside root", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-relative.css");
      const target = path.resolve("fixtures/folder/.image-relative.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "folder/generate-image.html",
          css: ["fixtures/styles/image-relative.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should rewrite relative images for html outside root with css file", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-relative-subfolder.css");
      const target = path.resolve("fixtures/folder/subfolder/.image-relative-subfolder.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "folder/subfolder/generate-image-absolute.html",
          target,
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should rewrite relative images for html outside root destFolder option", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-relative-subfolder.css");
      const target = path.resolve(".image-relative-subfolder.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "folder/subfolder/generate-image-absolute.html",
          // destFolder: 'folder/subfolder',
          // Dest: target,
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject, true),
      );
    });
  });

  test("should rewrite relative images for html inside root", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-skip.css");
      const target = path.resolve(".image-relative.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/image-relative.css"],
          target,
          // destFolder: '.',
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline absolute images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.resolve(".image-absolute.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/image-absolute.css"],
          target,
          // destFolder: '.',
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should skip to big images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-big.css");
      const target = path.resolve(".image-big.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/image-big.css"],
          target,
          // destFolder: '.',
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('considers "inlineImages" option', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-skip.css");
      const target = path.resolve(".image-skip.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/image-relative.css"],
          target,
          // destFolder: '.',
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should not screw up win32 paths", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.resolve(".image.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-image.html",
          css: ["fixtures/styles/some/path/image.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should respect pathPrefix", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/path-prefix.css");
      const target = path.resolve(".path-prefix1.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "path-prefix.html",
          css: ["fixtures/styles/path-prefix.css"],
          target,
          width: 1300,
          height: 900,
          // pathPrefix: ''
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should detect pathPrefix", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/path-prefix.css");
      const target = path.resolve(".path-prefix2.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "path-prefix.html",
          css: ["fixtures/styles/path-prefix.css"],
          target,
          // destFolder: '.',
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should generate and inline, if "inline" option is set', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline1.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline.html",
          // destFolder: '.',
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate and inline critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline2.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline.html",
          // destFolder: '.',
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate and inline minified critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline-minified3.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline.html",
          // destFolder: '.',
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should handle multiple calls", () => {
    return new Promise((resolve, reject) => {
      const expected1 = read("expected/generateInline.html");
      const expected2 = read("expected/generateInline-svg.html");

      async.series(
        {
          first(cb) {
            generate(
              {
                base: FIXTURES_DIR,
                src: "generateInline.html",
                inline: true,
              },
              cb,
            );
          },
          second(cb) {
            generate(
              {
                base: FIXTURES_DIR,
                src: "generateInline-svg.html",
                inline: true,
              },
              cb,
            );
          },
        },
        (err, results) => {
          try {
            expect(err).toBeFalsy();
            expect(nn(results.first.html)).toBe(expected1);
            expect(nn(results.second.html)).toBe(expected2);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  });

  test("should inline critical-path CSS ignoring remote stylesheets", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-external-minified.html");
      const target = path.resolve(".generateInline-external.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline-external.html",
          inlineImages: false,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline critical-path CSS with extract option ignoring remote stylesheets", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-external-extract.html");
      const target = path.resolve(".generateInline-external-extract.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline-external.html",
          inlineImages: false,
          extract: true,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline critical-path CSS without screwing svg images ", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-svg.html");
      const target = path.resolve(".generateInline-svg.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generateInline-svg.html",
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline and extract critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-extract.html");
      const target = path.resolve(".generateInline-extract.html");

      generate(
        {
          base: FIXTURES_DIR,
          extract: true,
          src: "generateInline.html",
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline and extract critical-path CSS from html source", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-extract.html");
      const target = path.resolve(".generateInline-extract-src.html");

      generate(
        {
          base: FIXTURES_DIR,
          extract: true,
          html: read("fixtures/generateInline.html"),
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should consider "ignore" option', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-ignore.css");
      const target = path.resolve(".ignore.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default.html",
          target,
          ignore: ["@media", ".header", /jumbotron/],

          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should handle empty "ignore" array', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.join(__dirname, ".ignore.min.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default.html",
          target,
          ignore: [],
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should handle ignore "@font-face"', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-ignorefont.css", true);
      const target = path.join(__dirname, ".ignorefont.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-ignorefont.html",
          target,
          ignore: ["@font-face"],
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should keep styles defined by the `include` option", () => {
    return new Promise((resolve, reject) => {
      const expected = read("fixtures/styles/include.css");
      const target = path.join(__dirname, ".include.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "include.html",
          include: [/someRule/],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("#192 - include option - generate", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/issue-192.css");
      const target = path.join(__dirname, ".issue-192.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-192.html",
          css: ["fixtures/styles/issue-192.css"],
          dimensions: [
            {
              width: 320,
              height: 480,
            },
            {
              width: 768,
              height: 1024,
            },
            {
              width: 1280,
              height: 960,
            },
            {
              width: 1920,
              height: 1080,
            },
          ],
          extract: false,
          ignore: ["@font-face", /url\(/],
          include: [/^\.main-navigation.*$/, /^\.hero-deck.*$/, /^\.deck.*$/, /^\.search-box.*$/],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should not complain about missing css if the css is passed via options", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default-nostyle.css");
      const target = path.join(__dirname, ".generate-default-nostyle.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-nostyle.html",
          css: ["fixtures/styles/bootstrap.css"],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should not complain about missing css if the css is passed via options (inline)", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default-nostyle.html");
      const target = path.join(__dirname, ".generate-default-nostyle.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "generate-default-nostyle.html",
          css: ["fixtures/styles/bootstrap.css"],
          target,
          inline: true,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should handle PAGE_UNLOADED_DURING_EXECUTION error (inline)", () => {
    return new Promise((resolve, reject) => {
      const expected = read("fixtures/issue-314.html");
      const target = path.join(__dirname, ".issue-314.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-314.html",
          css: ["fixtures/styles/bootstrap.css"],
          target,
          inline: true,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test.skip("should handle PAGE_UNLOADED_DURING_EXECUTION error", () => {
    return new Promise((resolve, reject) => {
      const expected = "";
      const target = path.join(__dirname, ".issue-314.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-314.html",
          css: ["fixtures/styles/bootstrap.css"],
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  // external css changed
  test.skip("external CSS with absolute url", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/issue-395.css");
      const target = path.join(__dirname, ".issue-395.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-395.html",
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("Correctly order css on multiple dimensions", () => {
    return new Promise((resolve, reject) => {
      const dimensions = [700, 600, 100, 200, 250, 150, 350, 400, 450, 500, 300, 550, 50].map(
        (width) => {
          return { width, height: 1000 };
        },
      );

      const expected = read("fixtures/styles/issue-415.css");
      const target = path.join(__dirname, ".issue-415.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-415.html",
          target,
          inline: false,
          dimensions,
          concurrency: 10,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("Ignore inlined stylesheets (disabled)", () => {
    return new Promise((resolve, reject) => {
      const inlineStyles = ".test-selector{color:#00f}";
      const target = path.join(__dirname, ".ignore-inlined-styles.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "ignoreInlinedStyles.html",
          target,
          ignoreInlinedStyles: false,
          inline: false,
          concurrency: 1,
        },
        assertCritical(target, inlineStyles, resolve, reject),
      );
    });
  });

  test("Ignore inlined stylesheets (enabled)", () => {
    return new Promise((resolve, reject) => {
      const target = path.join(__dirname, ".ignore-inlined-styles.css");
      generate(
        {
          base: FIXTURES_DIR,
          src: "ignoreInlinedStyles.html",
          target,
          ignoreInlinedStyles: true,
          inline: false,
          concurrency: 1,
        },
        assertCritical(target, "", resolve, reject),
      );
    });
  });

  test("issue #566 - consider base tag", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/issue-566.css");
      const target = path.join(__dirname, ".issue-566.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-566.html",
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("issue #580 - preserve modern CSS features (@container, @layer, :where, :has)", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/modern-css-features.css");
      const target = path.join(__dirname, ".modern-css-features.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "modern-css-features.html",
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("issue #615 - should not time out with lazy loaded iframes", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/lazy-iframe.css");
      const target = path.join(__dirname, ".lazy-iframe.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "lazy-iframe.html",
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("issue #613 - should write output when css variables start with a number", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/issue-613.css");
      const target = path.join(__dirname, ".issue-613.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: "issue-613.html",
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });
});

describe("generate (remote)", () => {
  test("should generate critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css");
      const target = path.join(__dirname, ".critical.css");

      generate(
        {
          src: `http://localhost:${port}/generate-default.html`,
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate multi-dimension critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-adaptive.css", "utf8");
      const target = path.join(__dirname, ".adaptive.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-adaptive.html`,
          target,
          penthouse: {
            timeout: 10_000,
          },
          dimensions: [
            {
              width: 100,
              height: 70,
            },
            {
              width: 1000,
              height: 70,
            },
          ],
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate minified critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.join(__dirname, ".critical.min.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-default.html`,
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate minified critical-path CSS successfully with external css file configured", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.join(__dirname, ".nostyle.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-default-nostyle.html`,
          css: ["fixtures/styles/main.css", "fixtures/styles/bootstrap.css"],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline relative images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.join(__dirname, ".image-relative.css");
      try {
        generate(
          {
            src: `http://localhost:${port}/generate-image.html`,
            target,
            width: 1300,
            height: 900,
            inlineImages: true,
          },
          assertCritical(target, expected, resolve, reject),
        );
      } catch (error) {
        console.log(error);
      }
    });
  });

  test("should inline relative images fetched over http", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.join(__dirname, ".image-relative.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/image-relative.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
          //  assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline absolute images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.join(__dirname, ".image-absolute.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/image-absolute.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline absolute images fetched over http", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.join(__dirname, ".image-absolute.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/image-absolute.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
          // assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should skip to big images", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-big.css");
      const target = path.join(__dirname, ".image-big.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/image-big.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('considers "inlineImages" option', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image-skip.css");
      const target = path.join(__dirname, ".image-skip.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/image-relative.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: false,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should not screw up win32 paths", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-image.css");
      const target = path.join(__dirname, ".image.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-image.html`,
          css: ["fixtures/styles/some/path/image.css"],
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should respect pathPrefix", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/path-prefix.css");
      const target = path.join(__dirname, ".path-prefix.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/path-prefix.html`,
          css: ["fixtures/styles/path-prefix.css"],
          target,
          width: 1300,
          height: 900,
          // Empty string most likely to candidate for failure if change in code results in checking option lazily,
          // pathPrefix: ''
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should detect pathPrefix", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/path-prefix.css");
      const target = path.join(__dirname, ".path-prefix.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/path-prefix.html`,
          css: ["fixtures/styles/path-prefix.css"],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should generate and inline, if "inline" option is set', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline.html`,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate and inline critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline.html`,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should generate and inline minified critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline.html");
      const target = path.join(__dirname, ".generateInline.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline.html`,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should handle multiple calls", () => {
    return new Promise((resolve, reject) => {
      const expected1 = read("expected/generateInline.html");
      const expected2 = read("expected/generateInline.html");
      async.series(
        {
          first(cb) {
            generate(
              {
                base: FIXTURES_DIR,
                src: `http://localhost:${port}/generateInline.html`,
                inline: true,
              },
              cb,
            );
          },
          second(cb) {
            generate(
              {
                base: FIXTURES_DIR,
                src: `http://localhost:${port}/generateInline.html`,
                inline: true,
              },
              cb,
            );
          },
        },
        (err, results) => {
          try {
            expect(err).toBeFalsy();
            expect(nn(results.first.html)).toBe(expected1);
            expect(nn(results.second.html)).toBe(expected2);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  });

  test("should inline critical-path CSS handling remote stylesheets", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-external-minified2.html");
      const target = path.join(__dirname, ".generateInline-external2.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline-external2.html`,
          inlineImages: false,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline critical-path CSS with extract option handling remote stylesheets", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-external-extract2.html");
      const target = path.join(__dirname, ".generateInline-external-extract.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline-external2.html`,
          inlineImages: false,
          extract: true,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline critical-path CSS without screwing svg images ", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-svg.html");
      const target = path.join(__dirname, ".generateInline-svg.html");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generateInline-svg.html`,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should inline and extract critical-path CSS", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generateInline-extract.html");
      const target = path.join(__dirname, ".generateInline-extract.html");

      generate(
        {
          base: FIXTURES_DIR,
          extract: true,
          src: `http://localhost:${port}/generateInline.html`,
          target,
          inline: true,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should consider "ignore" option', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-ignore.css");
      const target = path.join(__dirname, ".ignore.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-default.html`,
          target,
          ignore: ["@media", ".header", /jumbotron/],

          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should handle empty "ignore" array', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css", true);
      const target = path.join(__dirname, ".ignore.min.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-default.html`,
          target,
          ignore: [],
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test('should handle ignore "@font-face"', () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-ignorefont.css", true);
      const target = path.join(__dirname, ".ignorefont.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-ignorefont.html`,
          target,
          ignore: ["@font-face"],
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should keep styles defined by the `include` option", () => {
    return new Promise((resolve, reject) => {
      const expected = read("fixtures/styles/include.css");
      const target = path.join(__dirname, ".include.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/include.html`,
          include: [/someRule/],
          target,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should use the provided user agent to get the remote src", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/generate-default.css");
      const target = path.join(__dirname, ".critical.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/generate-default-useragent.html`,
          include: [/someRule/],
          target,
          width: 1300,
          height: 900,
          userAgent: "custom agent",
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });

  test("should use the provided request method to check for asset existance", async () => {
    const mockGet = vi.fn();
    const mockHead = vi.fn();
    nock(`http://localhost:${port}`, { allowUnmocked: true })
      .intercept("/styles/adaptive.css", "GET")
      .reply(200, mockGet)
      .intercept("/styles/adaptive.css", "HEAD")
      .reply(200, mockHead);

    await generate({
      base: FIXTURES_DIR,
      src: `http://localhost:${port}/generate-adaptive.html`,
      width: 1300,
      height: 900,
      request: { method: "get" },
    });

    expect(mockGet).toHaveBeenCalled();
    expect(mockHead).not.toHaveBeenCalled();

    await generate({
      base: FIXTURES_DIR,
      src: `http://localhost:${port}/generate-adaptive.html`,
      width: 1300,
      height: 900,
    });

    expect(mockHead).toHaveBeenCalled();
    nock.cleanAll();
  });

  test("issue #566 - consider base tag", () => {
    return new Promise((resolve, reject) => {
      const expected = read("expected/issue-566.css");
      const target = path.join(__dirname, ".issue-566.css");

      generate(
        {
          base: FIXTURES_DIR,
          src: `http://localhost:${port}/issue-566.html`,
          target,
          inline: false,
          width: 1300,
          height: 900,
        },
        assertCritical(target, expected, resolve, reject),
      );
    });
  });
});
