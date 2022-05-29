import {join, resolve, dirname} from 'node:path';
import {createServer} from 'node:http';
import {Buffer} from 'node:buffer';
import {readFileSync, unlink} from 'node:fs';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import {jest} from '@jest/globals';
import getPort from 'get-port';
import Vinyl from 'vinyl';
import nock from 'nock';
import {series} from 'async';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import nn from 'normalize-newline';
import {generate} from '../index.js';
import {read, readAndRemove} from './helper/index.js';

jest.setTimeout(100_000);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '/fixtures/');

function assertCritical(target, expected, done, skipTarget) {
  return (err, {css, html} = {}) => {
    const output = /\.css$/.test(target) ? css : html;

    if (err) {
      console.log(err);
      done(err);
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
      done(error);
      return;
    }

    done();
  };
}

// Setup static fileserver to mimic remote requests
let server;
let port;
beforeAll(async () => {
  const serve = serveStatic(join(__dirname, 'fixtures'), {index: ['index.html', 'index.htm']});
  const serveUserAgent = serveStatic(join(__dirname, 'fixtures/useragent'), {
    index: ['index.html', 'index.htm'],
  });

  port = await getPort();

  server = createServer((req, res) => {
    if (req.headers['user-agent'] === 'custom agent') {
      return serveUserAgent(req, res, finalhandler(req, res));
    }

    serve(req, res, finalhandler(req, res));
  }).listen(port);
});

afterAll(() => server.close());

// Prepare stderr mock
let stderr;
beforeEach(() => {
  stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderr.mockRestore();
});

describe('generate (local)', () => {
  test('generate critical-path CSS', (done) => {
    const expected = read('expected/generate-default.css');
    const target = resolve('.critical.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default.html',
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('generate critical-path CSS from CSS files passed as Vinyl objects', (done) => {
    const expected = read('expected/generate-default.css');
    const target = resolve('.critical.css');
    const stylesheets = ['fixtures/styles/main.css', 'fixtures/styles/bootstrap.css'].map((filePath) => {
      return new Vinyl({
        cwd: '/',
        base: '/fixtures/',
        path: filePath,
        contents: Buffer.from(readFileSync(join(__dirname, filePath), 'utf8'), 'utf8'),
      });
    });

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default-nostyle.html',
        target,
        css: stylesheets,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should throw an error on timeout', (done) => {
    const target = join(__dirname, '.include.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default.html',
        penthouse: {
          timeout: 1,
        },
        target,
        width: 1300,
        height: 900,
      },
      (err) => {
        expect(err).toBeInstanceOf(Error);
        done();
      }
    );
  });

  test('should throw a usable error when no stylesheets are found', (done) => {
    const target = join(__dirname, '.error.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'error.html',
        penthouse: {
          timeout: 1,
        },
        target,
        width: 1300,
        height: 900,
      },
      (err) => {
        expect(err).toBeInstanceOf(Error);
        unlink(target, () => done());
      }
    );
  });

  test('should generate critical-path CSS with query string in file name', (done) => {
    const expected = read('expected/generate-default.css');
    const target = resolve('.critical.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default-querystring.html',
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should ignore stylesheets blocked due to 403', (done) => {
    const expected = '';
    const target = resolve('.403.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: '403-css.html',
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should ignore stylesheets blocked due to 404', (done) => {
    const expected = '';
    const target = resolve('.404.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: '404-css.html',
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate multi-dimension critical-path CSS', (done) => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = resolve('.adaptive.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-adaptive.html',
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
      assertCritical(target, expected, done)
    );
  });

  test('should consider inline styles', (done) => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = resolve('.adaptive-inline.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-adaptive-inline.html',
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
      assertCritical(target, expected, done)
    );
  });

  test('should consider data uris in stylesheet hrefs', (done) => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = resolve('.adaptive-base64.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-adaptive-base64.html',
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
      assertCritical(target, expected, done)
    );
  });

  test('should generate minified critical-path CSS', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = resolve('.critical.min.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default.html',
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate minified critical-path CSS successfully with external css file configured', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = resolve('.nostyle.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default-nostyle.html',
        css: ['fixtures/styles/main.css', 'fixtures/styles/bootstrap.css'],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline relative images', (done) => {
    const expected = read('expected/generate-image.css');
    const target = resolve('.image-relative.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/image-relative.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline relative images from folder', (done) => {
    const expected = read('expected/generate-image.css');
    const target = resolve('.image-relative.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'folder/generate-image.html',
        css: ['fixtures/styles/image-relative.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should rewrite relative images for html outside root', (done) => {
    const expected = read('expected/generate-image-relative.css');
    const target = resolve('fixtures/folder/.image-relative.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'folder/generate-image.html',
        css: ['fixtures/styles/image-relative.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should rewrite relative images for html outside root with css file', (done) => {
    const expected = read('expected/generate-image-relative-subfolder.css');
    const target = resolve('fixtures/folder/subfolder/.image-relative-subfolder.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'folder/subfolder/generate-image-absolute.html',
        target,
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should rewrite relative images for html outside root destFolder option', (done) => {
    const expected = read('expected/generate-image-relative-subfolder.css');
    const target = resolve('.image-relative-subfolder.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'folder/subfolder/generate-image-absolute.html',
        // destFolder: 'folder/subfolder',
        // Dest: target,
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done, true)
    );
  });

  test('should rewrite relative images for html inside root', (done) => {
    const expected = read('expected/generate-image-skip.css');
    const target = resolve('.image-relative.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/image-relative.css'],
        target,
        // destFolder: '.',
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline absolute images', (done) => {
    const expected = read('expected/generate-image.css');
    const target = resolve('.image-absolute.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/image-absolute.css'],
        target,
        // destFolder: '.',
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should skip to big images', (done) => {
    const expected = read('expected/generate-image-big.css');
    const target = resolve('.image-big.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/image-big.css'],
        target,
        // destFolder: '.',
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('considers "inlineImages" option', (done) => {
    const expected = read('expected/generate-image-skip.css');
    const target = resolve('.image-skip.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/image-relative.css'],
        target,
        // destFolder: '.',
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should not screw up win32 paths', (done) => {
    const expected = read('expected/generate-image.css');
    const target = resolve('.image.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-image.html',
        css: ['fixtures/styles/some/path/image.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should respect pathPrefix', (done) => {
    const expected = read('expected/path-prefix.css');
    const target = resolve('.path-prefix1.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'path-prefix.html',
        css: ['fixtures/styles/path-prefix.css'],
        target,
        width: 1300,
        height: 900,
        // pathPrefix: ''
      },
      assertCritical(target, expected, done)
    );
  });

  test('should detect pathPrefix', (done) => {
    const expected = read('expected/path-prefix.css');
    const target = resolve('.path-prefix2.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'path-prefix.html',
        css: ['fixtures/styles/path-prefix.css'],
        target,
        // destFolder: '.',
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline, if "inline" option is set', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline1.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline.html',
        // destFolder: '.',
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline critical-path CSS', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline2.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline.html',
        // destFolder: '.',
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline minified critical-path CSS', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline-minified3.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline.html',
        // destFolder: '.',
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle multiple calls', (done) => {
    const expected1 = read('expected/generateInline.html');
    const expected2 = read('expected/generateInline-svg.html');

    series(
      {
        first(cb) {
          generate(
            {
              base: FIXTURES_DIR,
              src: 'generateInline.html',
              inline: true,
            },
            cb
          );
        },
        second(cb) {
          generate(
            {
              base: FIXTURES_DIR,
              src: 'generateInline-svg.html',
              inline: true,
            },
            cb
          );
        },
      },
      (err, results) => {
        try {
          expect(err).toBeFalsy();
          expect(nn(results.first.html)).toBe(expected1);
          expect(nn(results.second.html)).toBe(expected2);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });

  test('should inline critical-path CSS ignoring remote stylesheets', (done) => {
    const expected = read('expected/generateInline-external-minified.html');
    const target = resolve('.generateInline-external.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline-external.html',
        inlineImages: false,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline critical-path CSS with extract option ignoring remote stylesheets', (done) => {
    const expected = read('expected/generateInline-external-extract.html');
    const target = resolve('.generateInline-external-extract.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline-external.html',
        inlineImages: false,
        extract: true,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline critical-path CSS without screwing svg images ', (done) => {
    const expected = read('expected/generateInline-svg.html');
    const target = resolve('.generateInline-svg.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generateInline-svg.html',
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline and extract critical-path CSS', (done) => {
    const expected = read('expected/generateInline-extract.html');
    const target = resolve('.generateInline-extract.html');

    generate(
      {
        base: FIXTURES_DIR,
        extract: true,
        src: 'generateInline.html',
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline and extract critical-path CSS from html source', (done) => {
    const expected = read('expected/generateInline-extract.html');
    const target = resolve('.generateInline-extract-src.html');

    generate(
      {
        base: FIXTURES_DIR,
        extract: true,
        html: read('fixtures/generateInline.html'),
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should consider "ignore" option', (done) => {
    const expected = read('expected/generate-ignore.css');
    const target = resolve('.ignore.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default.html',
        target,
        ignore: ['@media', '.header', /jumbotron/],

        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle empty "ignore" array', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = join(__dirname, '.ignore.min.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default.html',
        target,
        ignore: [],
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle ignore "@font-face"', (done) => {
    const expected = read('expected/generate-ignorefont.css', true);
    const target = join(__dirname, '.ignorefont.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-ignorefont.html',
        target,
        ignore: ['@font-face'],
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should keep styles defined by the `include` option', (done) => {
    const expected = read('fixtures/styles/include.css');
    const target = join(__dirname, '.include.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'include.html',
        include: [/someRule/],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('#192 - include option - generate', (done) => {
    const expected = read('expected/issue-192.css');
    const target = join(__dirname, '.issue-192.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'issue-192.html',
        css: ['fixtures/styles/issue-192.css'],
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
        ignore: ['@font-face', /url\(/],
        include: [/^\.main-navigation.*$/, /^\.hero-deck.*$/, /^\.deck.*$/, /^\.search-box.*$/],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should not complain about missing css if the css is passed via options', (done) => {
    const expected = read('expected/generate-default-nostyle.css');
    const target = join(__dirname, '.generate-default-nostyle.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default-nostyle.html',
        css: ['fixtures/styles/bootstrap.css'],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should not complain about missing css if the css is passed via options (inline)', (done) => {
    const expected = read('expected/generate-default-nostyle.html');
    const target = join(__dirname, '.generate-default-nostyle.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'generate-default-nostyle.html',
        css: ['fixtures/styles/bootstrap.css'],
        target,
        inline: true,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle PAGE_UNLOADED_DURING_EXECUTION error (inline)', (done) => {
    const expected = read('fixtures/issue-314.html');
    const target = join(__dirname, '.issue-314.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'issue-314.html',
        css: ['fixtures/styles/bootstrap.css'],
        target,
        inline: true,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test.skip('should handle PAGE_UNLOADED_DURING_EXECUTION error', (done) => {
    const expected = '';
    const target = join(__dirname, '.issue-314.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'issue-314.html',
        css: ['fixtures/styles/bootstrap.css'],
        target,
        inline: false,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  // external css changed
  test.skip('external CSS with absolute url', (done) => {
    const expected = read('expected/issue-395.css');
    const target = join(__dirname, '.issue-395.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'issue-395.html',
        target,
        inline: false,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('Correctly order css on multiple dimensions', (done) => {
    const dimensions = [700, 600, 100, 200, 250, 150, 350, 400, 450, 500, 300, 550, 50].map((width) => {
      return {width, height: 1000};
    });

    const expected = read('fixtures/styles/issue-415.css');
    const target = join(__dirname, '.issue-415.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: 'issue-415.html',
        target,
        inline: false,
        dimensions,
        concurrency: 10,
      },
      assertCritical(target, expected, done)
    );
  });
});

describe('generate (remote)', () => {
  test('should generate critical-path CSS', (done) => {
    const expected = read('expected/generate-default.css');
    const target = join(__dirname, '.critical.css');

    generate(
      {
        src: `http://localhost:${port}/generate-default.html`,
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate multi-dimension critical-path CSS', (done) => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = join(__dirname, '.adaptive.css');

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
      assertCritical(target, expected, done)
    );
  });

  test('should generate minified critical-path CSS', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = join(__dirname, '.critical.min.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-default.html`,
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate minified critical-path CSS successfully with external css file configured', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = join(__dirname, '.nostyle.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-default-nostyle.html`,
        css: ['fixtures/styles/main.css', 'fixtures/styles/bootstrap.css'],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline relative images', (done) => {
    const expected = read('expected/generate-image.css');
    const target = join(__dirname, '.image-relative.css');
    try {
      generate(
        {
          src: `http://localhost:${port}/generate-image.html`,
          target,
          width: 1300,
          height: 900,
          inlineImages: true,
        },
        assertCritical(target, expected, done)
      );
    } catch (error) {
      console.log(error);
    }
  });

  test('should inline relative images fetched over http', (done) => {
    const expected = read('expected/generate-image.css');
    const target = join(__dirname, '.image-relative.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/image-relative.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
        //  assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline absolute images', (done) => {
    const expected = read('expected/generate-image.css');
    const target = join(__dirname, '.image-absolute.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/image-absolute.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline absolute images fetched over http', (done) => {
    const expected = read('expected/generate-image.css');
    const target = join(__dirname, '.image-absolute.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/image-absolute.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
        // assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
      },
      assertCritical(target, expected, done)
    );
  });

  test('should skip to big images', (done) => {
    const expected = read('expected/generate-image-big.css');
    const target = join(__dirname, '.image-big.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/image-big.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('considers "inlineImages" option', (done) => {
    const expected = read('expected/generate-image-skip.css');
    const target = join(__dirname, '.image-skip.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/image-relative.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: false,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should not screw up win32 paths', (done) => {
    const expected = read('expected/generate-image.css');
    const target = join(__dirname, '.image.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-image.html`,
        css: ['fixtures/styles/some/path/image.css'],
        target,
        width: 1300,
        height: 900,
        inlineImages: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should respect pathPrefix', (done) => {
    const expected = read('expected/path-prefix.css');
    const target = join(__dirname, '.path-prefix.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/path-prefix.html`,
        css: ['fixtures/styles/path-prefix.css'],
        target,
        width: 1300,
        height: 900,
        // Empty string most likely to candidate for failure if change in code results in checking option lazily,
        // pathPrefix: ''
      },
      assertCritical(target, expected, done)
    );
  });

  test('should detect pathPrefix', (done) => {
    const expected = read('expected/path-prefix.css');
    const target = join(__dirname, '.path-prefix.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/path-prefix.html`,
        css: ['fixtures/styles/path-prefix.css'],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline, if "inline" option is set', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline.html`,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline critical-path CSS', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline.html`,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should generate and inline minified critical-path CSS', (done) => {
    const expected = read('expected/generateInline.html');
    const target = join(__dirname, '.generateInline.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline.html`,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle multiple calls', (done) => {
    const expected1 = read('expected/generateInline.html');
    const expected2 = read('expected/generateInline.html');
    series(
      {
        first(cb) {
          generate(
            {
              base: FIXTURES_DIR,
              src: `http://localhost:${port}/generateInline.html`,
              inline: true,
            },
            cb
          );
        },
        second(cb) {
          generate(
            {
              base: FIXTURES_DIR,
              src: `http://localhost:${port}/generateInline.html`,
              inline: true,
            },
            cb
          );
        },
      },
      (err, results) => {
        expect(err).toBeFalsy();
        expect(nn(results.first.html)).toBe(expected1);
        expect(nn(results.second.html)).toBe(expected2);
        done(err);
      }
    );
  });

  test('should inline critical-path CSS handling remote stylesheets', (done) => {
    const expected = read('expected/generateInline-external-minified2.html');
    const target = join(__dirname, '.generateInline-external2.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline-external2.html`,
        inlineImages: false,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline critical-path CSS with extract option handling remote stylesheets', (done) => {
    const expected = read('expected/generateInline-external-extract2.html');
    const target = join(__dirname, '.generateInline-external-extract.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline-external2.html`,
        inlineImages: false,
        extract: true,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline critical-path CSS without screwing svg images ', (done) => {
    const expected = read('expected/generateInline-svg.html');
    const target = join(__dirname, '.generateInline-svg.html');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generateInline-svg.html`,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should inline and extract critical-path CSS', (done) => {
    const expected = read('expected/generateInline-extract.html');
    const target = join(__dirname, '.generateInline-extract.html');

    generate(
      {
        base: FIXTURES_DIR,
        extract: true,
        src: `http://localhost:${port}/generateInline.html`,
        target,
        inline: true,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should consider "ignore" option', (done) => {
    const expected = read('expected/generate-ignore.css');
    const target = join(__dirname, '.ignore.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-default.html`,
        target,
        ignore: ['@media', '.header', /jumbotron/],

        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle empty "ignore" array', (done) => {
    const expected = read('expected/generate-default.css', true);
    const target = join(__dirname, '.ignore.min.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-default.html`,
        target,
        ignore: [],
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should handle ignore "@font-face"', (done) => {
    const expected = read('expected/generate-ignorefont.css', true);
    const target = join(__dirname, '.ignorefont.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-ignorefont.html`,
        target,
        ignore: ['@font-face'],
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should keep styles defined by the `include` option', (done) => {
    const expected = read('fixtures/styles/include.css');
    const target = join(__dirname, '.include.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/include.html`,
        include: [/someRule/],
        target,
        width: 1300,
        height: 900,
      },
      assertCritical(target, expected, done)
    );
  });

  test('should use the provided user agent to get the remote src', (done) => {
    const expected = read('expected/generate-default.css');
    const target = join(__dirname, '.critical.css');

    generate(
      {
        base: FIXTURES_DIR,
        src: `http://localhost:${port}/generate-default-useragent.html`,
        include: [/someRule/],
        target,
        width: 1300,
        height: 900,
        userAgent: 'custom agent',
      },
      assertCritical(target, expected, done)
    );
  });

  test('should use the provided request method to check for asset existance', async () => {
    const mockGet = jest.fn();
    const mockHead = jest.fn();
    nock(`http://localhost:${port}`, {allowUnmocked: true})
      .intercept('/styles/adaptive.css', 'GET')
      .reply(200, mockGet)
      .intercept('/styles/adaptive.css', 'HEAD')
      .reply(200, mockHead);

    await generate({
      base: FIXTURES_DIR,
      src: `http://localhost:${port}/generate-adaptive.html`,
      width: 1300,
      height: 900,
      request: {method: 'get'},
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
  });
});
