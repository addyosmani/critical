/* eslint-env jest node */
const path = require('path');
const {createServer} = require('http');
const getPort = require('get-port');
const Vinyl = require('vinyl');
const async = require('async');
const fs = require('fs-extra');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const nn = require('normalize-newline');
const {generate} = require('../index');
const {read, readAndRemove} = require('./helper');

jest.setTimeout(20000);

process.chdir(path.resolve(__dirname));

function assertCritical(target, expected, done, skipTarget) {
  return function (err, {css, html} = {}) {
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
    } catch (err) {
      done(err);
      return;
    }
    done();
  };
}

// Setup static fileserver to mimic remote requests
let server;
let port;
beforeAll(async () => {
  const root = path.join(__dirname, 'fixtures');
  const serve = serveStatic(root, {index: ['index.html', 'index.htm']});
  const serveUserAgent = serveStatic('fixtures/useragent', {
    index: ['index.html', 'index.htm']
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
  test('generate critical-path CSS', done => {
    const expected = read('expected/generate-default.css');
    const target = path.resolve('.critical.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default.html',
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('generate critical-path CSS from CSS files passed as Vinyl objects', done => {
    const expected = read('expected/generate-default.css');
    const target = path.resolve('.critical.css');
    const stylesheets = ['fixtures/styles/main.css', 'fixtures/styles/bootstrap.css']
      .map(filePath => {
        return new Vinyl({
          cwd: '/',
          base: '/fixtures/',
          path: filePath,
          contents: Buffer.from(fs.readFileSync(path.join(__dirname, filePath), 'utf8'), 'utf8')
        });
      });

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default-nostyle.html',
      target: target,
      css: stylesheets,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should throw an error on timeout', done => {
    const target = path.join(__dirname, '.include.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default.html',
      penthouse: {
        timeout: 1
      },
      target: target,
      width: 1300,
      height: 900
    }, err => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  test('should throw an usable error when no stylesheets are found', done => {
    const target = path.join(__dirname, '.error.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'error.html',
      penthouse: {
        timeout: 1
      },
      target: target,
      width: 1300,
      height: 900
    }, err => {
      expect(err).toBeInstanceOf(Error);
      fs.remove(target, () => done());
    });
  });

  test('should generate critical-path CSS with query string in file name', done => {
    const expected = read('expected/generate-default.css');
    const target = path.resolve('.critical.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default-querystring.html',
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should ignore stylesheets blocked due to 403', done => {
    const expected = '';
    const target = path.resolve('.403.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: '403-css.html',
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should ignore stylesheets blocked due to 404', done => {
    const expected = '';
    const target = path.resolve('.404.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: '404-css.html',
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate multi-dimension critical-path CSS', done => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = path.resolve('.adaptive.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-adaptive.html',
      target: target,
      dimensions: [{
        width: 100,
        height: 70
      }, {
        width: 1000,
        height: 70
      }]
    }, assertCritical(target, expected, done));
  });

  test('should generate minified critical-path CSS', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.resolve('.critical.min.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default.html',
      minify: true,
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate minified critical-path CSS successfully with external css file configured', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.resolve('.nostyle.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default-nostyle.html',
      css: [
        'fixtures/styles/main.css',
        'fixtures/styles/bootstrap.css'
      ],
      minify: true,
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should inline relative images', done => {
    const expected = read('expected/generate-image.css');
    const target = path.resolve('.image-relative.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should inline relative images from folder', done => {
    const expected = read('expected/generate-image.css');
    const target = path.resolve('.image-relative.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'folder/generate-image.html',
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should rewrite relative images for html outside root', done => {
    const expected = read('expected/generate-image-relative.css');
    const target = path.resolve('fixtures/folder/.image-relative.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'folder/generate-image.html',
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done));
  });

  test('should rewrite relative images for html outside root with css file', done => {
    const expected = read('expected/generate-image-relative-subfolder.css');
    const target = path.resolve('fixtures/folder/subfolder/.image-relative-subfolder.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'folder/subfolder/generate-image-absolute.html',
      target: target,
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done));
  });

  test('should rewrite relative images for html outside root destFolder option', done => {
    const expected = read('expected/generate-image-relative-subfolder.css');
    const target = path.resolve('.image-relative-subfolder.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'folder/subfolder/generate-image-absolute.html',
      // destFolder: 'folder/subfolder',
      // Dest: target,
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done, true));
  });

  test('should rewrite relative images for html inside root', done => {
    const expected = read('expected/generate-image-skip.css');
    const target = path.resolve('.image-relative.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      // destFolder: '.',
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done));
  });

  test('should inline absolute images', done => {
    const expected = read('expected/generate-image.css');
    const target = path.resolve('.image-absolute.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/image-absolute.css'
      ],
      target: target,
      // destFolder: '.',
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should skip to big images', done => {
    const expected = read('expected/generate-image-big.css');
    const target = path.resolve('.image-big.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/image-big.css'
      ],
      target: target,
      // destFolder: '.',
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('considers "inlineImages" option', done => {
    const expected = read('expected/generate-image-skip.css');
    const target = path.resolve('.image-skip.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      // destFolder: '.',
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done));
  });

  test('should not screw up win32 paths', done => {
    const expected = read('expected/generate-image.css');
    const target = path.resolve('.image.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-image.html',
      css: [
        'fixtures/styles/some/path/image.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should respect pathPrefix', done => {
    const expected = read('expected/path-prefix.css');
    const target = path.resolve('.path-prefix1.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'path-prefix.html',
      css: [
        'fixtures/styles/path-prefix.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      //pathPrefix: ''
    }, assertCritical(target, expected, done));
  });

  test('should detect pathPrefix', done => {
    const expected = read('expected/path-prefix.css');
    const target = path.resolve('.path-prefix2.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'path-prefix.html',
      css: [
        'fixtures/styles/path-prefix.css'
      ],
      target: target,
      // destFolder: '.',
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline, if "inline" option is set', done => {
    const expected = read('expected/generateInline.html');
    const target = path.join(__dirname, '.generateInline1.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generateInline.html',
      // destFolder: '.',
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline critical-path CSS', done => {
    const expected = read('expected/generateInline.html');
    const target = path.join(__dirname, '.generateInline2.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generateInline.html',
      // destFolder: '.',
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline minified critical-path CSS', done => {
    const expected = read('expected/generateInline-minified.html');
    const target = path.join(__dirname, '.generateInline-minified3.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generateInline.html',
      // destFolder: '.',
      minify: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should handle multiple calls', done => {
    const expected1 = read('expected/generateInline-unminified.html');
    const expected2 = read('expected/generateInline-minified.html');

    async.series({
      first(cb) {
        generate({
          base: path.join(__dirname, '/fixtures/'),
          minify: false,
          src: 'generateInline.html',
          inline: true,
        }, cb);
      },
      second(cb) {
        generate({
          base: path.join(__dirname, '/fixtures/'),
          minify: true,
          src: 'generateInline.html',
          inline: true
        }, cb);
      }
    }, (err, results) => {
      try {
        expect(err).toBeFalsy();
        expect(nn(results.first.html)).toBe(expected1);
        expect(nn(results.second.html)).toBe(expected2);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('should inline critical-path CSS ignoring remote stylesheets', done => {
    const expected = read('expected/generateInline-external-minified.html');
    const target = path.resolve('.generateInline-external.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generateInline-external.html',
      inlineImages: false,
      minify: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline critical-path CSS with extract option ignoring remote stylesheets', done => {
    const expected = read('expected/generateInline-external-extract.html');
    const target = path.resolve('.generateInline-external-extract.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generateInline-external.html',
      inlineImages: false,
      minify: true,
      extract: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline critical-path CSS without screwing svg images ', done => {
    const expected = read('expected/generateInline-svg.html');
    const target = path.resolve('.generateInline-svg.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      minify: true,
      src: 'generateInline-svg.html',
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline and extract critical-path CSS', done => {
    const expected = read('expected/generateInline-extract.html');
    const target = path.resolve('.generateInline-extract.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      minify: true,
      extract: true,
      src: 'generateInline.html',
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline and extract critical-path CSS from html source', done => {
    const expected = read('expected/generateInline-extract.html');
    const target = path.resolve('.generateInline-extract-src.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      minify: true,
      extract: true,
      html: read('fixtures/generateInline.html'),
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should consider "ignore" option', done => {
    const expected = read('expected/generate-ignore.css');
    const target = path.resolve('.ignore.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default.html',
      target: target,
      ignore: ['@media', '.header', /jumbotron/],

      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle empty "ignore" array', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.join(__dirname, '.ignore.min.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default.html',
      target: target,
      ignore: [],
      minify: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle ignore "@font-face"', done => {
    const expected = read('expected/generate-ignorefont.css', true);
    const target = path.join(__dirname, '.ignorefont.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-ignorefont.html',
      target: target,
      ignore: ['@font-face'],
      minify: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should keep styles defined by the `include` option', done => {
    const expected = read('fixtures/styles/include.css');
    const target = path.join(__dirname, '.include.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'include.html',
      include: [/someRule/],
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('#192 - include option - generate', done => {
    const expected = read('expected/issue-192.css');
    const target = path.join(__dirname, '.issue-192.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'issue-192.html',
      css: ['fixtures/styles/issue-192.css'],
      dimensions: [{
        width: 320,
        height: 480
      }, {
        width: 768,
        height: 1024
      }, {
        width: 1280,
        height: 960
      }, {
        width: 1920,
        height: 1080
      }],
      minify: true,
      extract: false,
      ignore: ['@font-face', /url\(/],
      include: [/^\.main-navigation.*$/,
        /^\.hero-deck.*$/,
        /^\.deck.*$/,
        /^\.search-box.*$/],
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should not complain about missing css if the css is passed via options', done => {
    const expected = read('expected/generate-default-nostyle.css');
    const target = path.join(__dirname, '.generate-default-nostyle.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default-nostyle.html',
      css: ['fixtures/styles/bootstrap.css'],
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should not complain about missing css if the css is passed via options (inline)', done => {
    const expected = read('expected/generate-default-nostyle.html');
    const target = path.join(__dirname, '.generate-default-nostyle.html');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'generate-default-nostyle.html',
      css: ['fixtures/styles/bootstrap.css'],
      target: target,
      inline: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle PAGE_UNLOADED_DURING_EXECUTION error (inline)', done => {
    const expected = read('fixtures/issue-314.html');
    const target = path.join(__dirname, '.issue-314.html');


    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'issue-314.html',
      css: ['fixtures/styles/bootstrap.css'],
      target: target,
      inline: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle PAGE_UNLOADED_DURING_EXECUTION error', done => {
    const expected = '';
    const target = path.join(__dirname, '.issue-314.css');

    generate({
      base: path.join(__dirname, '/fixtures/'),
      src: 'issue-314.html',
      css: ['fixtures/styles/bootstrap.css'],
      target: target,
      inline: false,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });
});

describe('generate (remote)', () => {
  test('should generate critical-path CSS', done => {
    const expected = read('expected/generate-default.css');
    const target = path.join(__dirname, '.critical.css');

    generate({
      src: `http://localhost:${port}/generate-default.html`,
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate multi-dimension critical-path CSS', done => {
    const expected = read('expected/generate-adaptive.css', 'utf8');
    const target = path.join(__dirname, '.adaptive.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-adaptive.html`,
      target: target,
      dimensions: [{
        width: 100,
        height: 70
      }, {
        width: 1000,
        height: 70
      }]
    }, assertCritical(target, expected, done));
  });

  test('should generate minified critical-path CSS', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.join(__dirname, '.critical.min.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-default.html`,
      minify: true,
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate minified critical-path CSS successfully with external css file configured', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.join(__dirname, '.nostyle.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-default-nostyle.html`,
      css: [
        'fixtures/styles/main.css',
        'fixtures/styles/bootstrap.css'
      ],
      minify: true,
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should inline relative images', done => {
    const expected = read('expected/generate-image.css');
    const target = path.join(__dirname, '.image-relative.css');
    try {
      generate({
        src: `http://localhost:${port}/generate-image.html`,
        target: target,
        width: 1300,
        height: 900,
        inlineImages: true
      }, assertCritical(target, expected, done));
    } catch (error) {
      console.log(error);
    }
  });

  test('should inline relative images fetched over http', done => {
    const expected = read('expected/generate-image.css');
    const target = path.join(__dirname, '.image-relative.css');

    generate({
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true,
      //  assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
    }, assertCritical(target, expected, done));
  });

  test('should inline absolute images', done => {
    const expected = read('expected/generate-image.css');
    const target = path.join(__dirname, '.image-absolute.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/image-absolute.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should inline absolute images fetched over http', done => {
    const expected = read('expected/generate-image.css');
    const target = path.join(__dirname, '.image-absolute.css');

    generate({
      base: './',
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/image-absolute.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true,
      // assetPaths: [`http://localhost:${port}/`, `http://localhost:${port}/styles`]
    }, assertCritical(target, expected, done));
  });

  test('should skip to big images', done => {
    const expected = read('expected/generate-image-big.css');
    const target = path.join(__dirname, '.image-big.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/image-big.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('considers "inlineImages" option', done => {
    const expected = read('expected/generate-image-skip.css');
    const target = path.join(__dirname, '.image-skip.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/image-relative.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: false
    }, assertCritical(target, expected, done));
  });

  test('should not screw up win32 paths', done => {
    const expected = read('expected/generate-image.css');
    const target = path.join(__dirname, '.image.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-image.html`,
      css: [
        'fixtures/styles/some/path/image.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      inlineImages: true
    }, assertCritical(target, expected, done));
  });

  test('should respect pathPrefix', done => {
    const expected = read('expected/path-prefix.css');
    const target = path.join(__dirname, '.path-prefix.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/path-prefix.html`,
      css: [
        'fixtures/styles/path-prefix.css'
      ],
      target: target,
      width: 1300,
      height: 900,
      // Empty string most likely to candidate for failure if change in code results in checking option lazily,
      //pathPrefix: ''
    }, assertCritical(target, expected, done));
  });

  test('should detect pathPrefix', done => {
    const expected = read('expected/path-prefix.css');
    const target = path.join(__dirname, '.path-prefix.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/path-prefix.html`,
      css: [
        'fixtures/styles/path-prefix.css'
      ],
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline, if "inline" option is set', done => {
    const expected = read('expected/generateInline.html');
    const target = path.join(__dirname, '.generateInline.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generateInline.html`,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline critical-path CSS', done => {
    const expected = read('expected/generateInline.html');
    const target = path.join(__dirname, '.generateInline.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generateInline.html`,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should generate and inline minified critical-path CSS', done => {
    const expected = read('expected/generateInline-minified.html');
    const target = path.join(__dirname, '.generateInline-minified.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generateInline.html`,
      minify: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should handle multiple calls', done => {
    const expected1 = read('expected/generateInline.html');
    const expected2 = read('expected/generateInline-minified.html');
    async.series({
      first(cb) {
        generate({
          base:  path.join(__dirname, '/fixtures/'),
          src: `http://localhost:${port}/generateInline.html`,
          inline: true
        }, cb);
      },
      second(cb) {
        generate({
          base:  path.join(__dirname, '/fixtures/'),
          minify: true,
          src: `http://localhost:${port}/generateInline.html`,
          inline: true
        }, cb);
      }
    }, (err, results) => {
      expect(err).toBeFalsy();
      expect(nn(results.first.html)).toBe(expected1);
      expect(nn(results.second.html)).toBe(expected2);
      done(err);
    });
  });

  test('should inline critical-path CSS handling remote stylesheets', done => {
    const expected = read('expected/generateInline-external-minified2.html');
    const target = path.join(__dirname, '.generateInline-external2.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generateInline-external2.html`,
      inlineImages: false,
      minify: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline critical-path CSS with extract option handling remote stylesheets', done => {
    const expected = read('expected/generateInline-external-extract2.html');
    const target = path.join(__dirname, '.generateInline-external-extract.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generateInline-external2.html`,
      inlineImages: false,
      minify: true,
      extract: true,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline critical-path CSS without screwing svg images ', done => {
    const expected = read('expected/generateInline-svg.html');
    const target = path.join(__dirname, '.generateInline-svg.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      minify: true,
      src: `http://localhost:${port}/generateInline-svg.html`,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should inline and extract critical-path CSS', done => {
    const expected = read('expected/generateInline-extract.html');
    const target = path.join(__dirname, '.generateInline-extract.html');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      minify: true,
      extract: true,
      src: `http://localhost:${port}/generateInline.html`,
      target: target,
      inline: true
    }, assertCritical(target, expected, done));
  });

  test('should consider "ignore" option', done => {
    const expected = read('expected/generate-ignore.css');
    const target = path.join(__dirname, '.ignore.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-default.html`,
      target: target,
      ignore: ['@media', '.header', /jumbotron/],

      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle empty "ignore" array', done => {
    const expected = read('expected/generate-default.css', true);
    const target = path.join(__dirname, '.ignore.min.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-default.html`,
      target: target,
      ignore: [],
      minify: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should handle ignore "@font-face"', done => {
    const expected = read('expected/generate-ignorefont.css', true);
    const target = path.join(__dirname, '.ignorefont.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-ignorefont.html`,
      target: target,
      ignore: ['@font-face'],
      minify: true,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should keep styles defined by the `include` option', done => {
    const expected = read('fixtures/styles/include.css');
    const target = path.join(__dirname, '.include.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/include.html`,
      include: [/someRule/],
      target: target,
      width: 1300,
      height: 900
    }, assertCritical(target, expected, done));
  });

  test('should use the provided user agent to get the remote src', done => {
    const expected = read('expected/generate-default.css');
    const target = path.join(__dirname, '.critical.css');

    generate({
      base:  path.join(__dirname, '/fixtures/'),
      src: `http://localhost:${port}/generate-default-useragent.html`,
      include: [/someRule/],
      target: target,
      width: 1300,
      height: 900,
      userAgent: 'custom agent'
    }, assertCritical(target, expected, done));
  });
});
