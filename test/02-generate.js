/* eslint-env node, mocha */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const nn = require('normalize-newline');
const {assert} = require('chai');
const async = require('async');
const getPort = require('get-port');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const Vinyl = require('vinyl');
const critical = require('..');
const {read, assertCritical} = require('./helper/testhelper');

process.chdir(path.resolve(__dirname));

describe('Module - generate', () => {
    after(() => {
        process.emit('cleanup');
    });

    it('should generate critical-path CSS', done => {
        const expected = read('expected/generate-default.css');
        const target = path.resolve('.critical.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate critical-path CSS from CSS files passed as Vinyl objects', done => {
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

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-nostyle.html',
            dest: target,
            css: stylesheets,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should throw an error on timeout', done => {
        const target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            timeout: 1,
            dest: target,
            width: 1300,
            height: 900
        }, err => {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should throw an usable error when no stylesheets are found', done => {
        const target = '.error.css';

        critical.generate({
            base: 'fixtures/',
            src: 'error.html',
            timeout: 1,
            dest: target,
            width: 1300,
            height: 900
        }, err => {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should generate critical-path CSS with query string in file name', done => {
        const expected = read('expected/generate-default.css');
        const target = path.resolve('.critical.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-querystring.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should ignore stylesheets blocked due to 403', done => {
        const expected = '';
        const target = path.resolve('.403.css');

        critical.generate({
            base: 'fixtures/',
            src: '403-css.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should ignore stylesheets blocked due to 404', done => {
        const expected = '';
        const target = path.resolve('.404.css');

        critical.generate({
            base: 'fixtures/',
            src: '404-css.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate multi-dimension critical-path CSS', done => {
        const expected = read('expected/generate-adaptive.css', 'utf8');
        const target = path.resolve('.adaptive.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-adaptive.html',
            dest: target,
            dimensions: [{
                width: 100,
                height: 70
            }, {
                width: 1000,
                height: 70
            }]
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS', done => {
        const expected = read('expected/generate-default.css', true);
        const target = path.resolve('.critical.min.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS successfully with external css file configured', done => {
        const expected = read('expected/generate-default.css', true);
        const target = path.resolve('.nostyle.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-nostyle.html',
            css: [
                'fixtures/styles/main.css',
                'fixtures/styles/bootstrap.css'
            ],
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should inline relative images', done => {
        const expected = read('expected/generate-image.css');
        const target = path.resolve('.image-relative.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline relative images from folder', done => {
        const expected = read('expected/generate-image.css');
        const target = path.resolve('.image-relative.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            destFolder: 'folder/',
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should rewrite relative images for html outside root', done => {
        const expected = read('expected/generate-image-relative.css');
        const target = path.resolve('fixtures/folder/.image-relative.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should rewrite relative images for html outside root with css file', done => {
        const expected = read('expected/generate-image-relative-subfolder.css');
        const target = path.resolve('fixtures/folder/subfolder/.image-relative-subfolder.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/subfolder/generate-image-absolute.html',
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should rewrite relative images for html outside root destFolder option', done => {
        const expected = read('expected/generate-image-relative-subfolder.css');
        const target = path.resolve('.image-relative-subfolder.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/subfolder/generate-image-absolute.html',
            destFolder: 'folder/subfolder',
            // Dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done, true));
    });

    it('should rewrite relative images for html inside root', done => {
        const expected = read('expected/generate-image-skip.css');
        const target = path.resolve('.image-relative.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            destFolder: '.',
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images', done => {
        const expected = read('expected/generate-image.css');
        const target = path.resolve('.image-absolute.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            destFolder: '.',
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should skip to big images', done => {
        const expected = read('expected/generate-image-big.css');
        const target = path.resolve('.image-big.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/image-big.css'
            ],
            dest: target,
            destFolder: '.',
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('considers "inlineImages" option', done => {
        const expected = read('expected/generate-image-skip.css');
        const target = path.resolve('.image-skip.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            destFolder: '.',
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should not screw up win32 paths', done => {
        const expected = read('expected/generate-image.css');
        const target = path.resolve('.image.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-image.html',
            css: [
                'fixtures/styles/some/path/image.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should respect pathPrefix', done => {
        const expected = read('expected/path-prefix.css');
        const target = path.resolve('.path-prefix.css');

        critical.generate({
            base: 'fixtures/',
            src: 'path-prefix.html',
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            pathPrefix: ''
        }, assertCritical(target, expected, done));
    });

    it('should detect pathPrefix', done => {
        const expected = read('expected/path-prefix.css');
        const target = path.resolve('.path-prefix.css');

        critical.generate({
            base: 'fixtures/',
            src: 'path-prefix.html',
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            destFolder: '.',
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline, if "inline" option is set', done => {
        const expected = read('expected/generateInline.html');
        const target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should generate and inline critical-path CSS', done => {
        const expected = read('expected/generateInline.html');
        const target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should generate and inline minified critical-path CSS', done => {
        const expected = read('expected/generateInline-minified.html');
        const target = '.generateInline-minified.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should handle multiple calls', done => {
        const expected1 = read('expected/generateInline.html');
        const expected2 = read('expected/generateInline-minified.html');

        async.series({
            first(cb) {
                critical.generate({
                    base: 'fixtures/',
                    src: 'generateInline.html',
                    inline: true
                }, cb);
            },
            second(cb) {
                critical.generate({
                    base: 'fixtures/',
                    minify: true,
                    src: 'generateInline.html',
                    inline: true
                }, cb);
            }
        }, (err, results) => {
            assert.isNull(err, Boolean(err) && err);
            assert.strictEqual(nn(results.first), nn(expected1));
            assert.strictEqual(nn(results.second), nn(expected2));
            done();
        });
    });

    it('should inline critical-path CSS ignoring remote stylesheets', done => {
        const expected = read('expected/generateInline-external-minified.html');
        const target = path.resolve('.generateInline-external.html');

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS with extract option ignoring remote stylesheets', done => {
        const expected = read('expected/generateInline-external-extract.html');
        const target = path.resolve('.generateInline-external-extract.html');

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            extract: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS without screwing svg images ', done => {
        const expected = read('expected/generateInline-svg.html');
        const target = path.resolve('.generateInline-svg.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            src: 'generateInline-svg.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', done => {
        const expected = read('expected/generateInline-extract.html');
        const target = path.resolve('.generateInline-extract.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: 'generateInline.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS from html source', done => {
        const expected = read('expected/generateInline-extract.html');
        const target = path.resolve('.generateInline-extract-src.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            html: read('fixtures/generateInline.html'),
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should consider "ignore" option', done => {
        const expected = read('expected/generate-ignore.css');
        const target = path.resolve('.ignore.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            dest: target,
            ignore: ['@media', '.header', /jumbotron/],

            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle empty "ignore" array', done => {
        const expected = read('expected/generate-default.css', true);
        const target = '.ignore.min.css';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            dest: target,
            ignore: [],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle ignore "@font-face"', done => {
        const expected = read('expected/generate-ignorefont.css', true);
        const target = '.ignorefont.css';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-ignorefont.html',
            dest: target,
            ignore: ['@font-face'],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should keep styles defined by the `include` option', done => {
        const expected = read('fixtures/styles/include.css');
        const target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: 'include.html',
            include: [/someRule/],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('#192 - include option - generate', done => {
        const expected = read('expected/issue-192.css');
        const target = '.issue-192.css';

        critical.generate({
            base: 'fixtures/',
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
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should not complain about missing css if the css is passed via options', done => {
        const expected = read('expected/generate-default-nostyle.css');
        const target = '.generate-default-nostyle.css';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-nostyle.html',
            css: ['fixtures/styles/bootstrap.css'],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should not complain about missing css if the css is passed via options (inline)', done => {
        const expected = read('expected/generate-default-nostyle.html');
        const target = '.generate-default-nostyle.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-nostyle.html',
            css: ['fixtures/styles/bootstrap.css'],
            dest: target,
            inline: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle PAGE_UNLOADED_DURING_EXECUTION error (inline)', done => {
        const expected = read('fixtures/issue-314.html');
        const target = '.issue-314.html';

        critical.generate({
            base: 'fixtures/',
            src: 'issue-314.html',
            css: ['fixtures/styles/bootstrap.css'],
            dest: target,
            inline: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle PAGE_UNLOADED_DURING_EXECUTION error', done => {
        const expected = '';
        const target = '.issue-314.css';

        critical.generate({
            base: 'fixtures/',
            src: 'issue-314.html',
            css: ['fixtures/styles/bootstrap.css'],
            dest: target,
            inline: false,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });
});

describe('Module - generate (remote)', () => {
    before(() => {
        const serve = serveStatic('fixtures', {index: ['index.html', 'index.htm']});
        const serveUserAgent = serveStatic('fixtures/useragent', {
            index: ['index.html', 'index.htm']
        });

        this.server = http.createServer((req, res) => {
            if (req.headers['user-agent'] === 'custom agent') {
                return serveUserAgent(req, res, finalhandler(req, res));
            }
            serve(req, res, finalhandler(req, res));
        });

        return getPort().then(port => {
            this.server.listen(port);
            this.port = port;
        });
    });

    after(() => {
        this.server.close();
    });

    it('should generate critical-path CSS', done => {
        const expected = read('expected/generate-default.css');
        const target = '.critical.css';

        critical.generate({
            src: `http://localhost:${this.port}/generate-default.html`,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate multi-dimension critical-path CSS', done => {
        const expected = read('expected/generate-adaptive.css', 'utf8');
        const target = '.adaptive.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-adaptive.html`,
            dest: target,
            dimensions: [{
                width: 100,
                height: 70
            }, {
                width: 1000,
                height: 70
            }]
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS', done => {
        const expected = read('expected/generate-default.css', true);
        const target = '.critical.min.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-default.html`,
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS successfully with external css file configured', done => {
        const expected = read('expected/generate-default.css', true);
        const target = '.nostyle.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-default-nostyle.html`,
            css: [
                'fixtures/styles/main.css',
                'fixtures/styles/bootstrap.css'
            ],
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should inline relative images', done => {
        const expected = read('expected/generate-image.css');
        const target = '.image-relative.css';

        critical.generate({
            src: `http://localhost:${this.port}/generate-image.html`,
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline relative images fetched over http', done => {
        const expected = read('expected/generate-image.css');
        const target = '.image-relative.css';

        critical.generate({
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true,
            assetPaths: [`http://localhost:${this.port}/`, `http://localhost:${this.port}/styles`]
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images', done => {
        const expected = read('expected/generate-image.css');
        const target = '.image-absolute.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images fetched over http', done => {
        const expected = read('expected/generate-image.css');
        const target = '.image-absolute.css';

        critical.generate({
            base: './',
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true,
            assetPaths: [`http://localhost:${this.port}/`, `http://localhost:${this.port}/styles`]
        }, assertCritical(target, expected, done));
    });

    it('should skip to big images', done => {
        const expected = read('expected/generate-image-big.css');
        const target = '.image-big.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/image-big.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('considers "inlineImages" option', done => {
        const expected = read('expected/generate-image-skip.css');
        const target = '.image-skip.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should not screw up win32 paths', done => {
        const expected = read('expected/generate-image.css');
        const target = '.image.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-image.html`,
            css: [
                'fixtures/styles/some/path/image.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should respect pathPrefix', done => {
        const expected = read('expected/path-prefix.css');
        const target = '.path-prefix.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/path-prefix.html`,
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            // Empty string most likely to candidate for failure if change in code results in checking option lazily,
            pathPrefix: ''
        }, assertCritical(target, expected, done));
    });

    it('should detect pathPrefix', done => {
        const expected = read('expected/path-prefix.css');
        const target = '.path-prefix.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/path-prefix.html`,
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline, if "inline" option is set', done => {
        const expected = read('expected/generateInline.html');
        const target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generateInline.html`,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline critical-path CSS', done => {
        const expected = read('expected/generateInline.html');
        const target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generateInline.html`,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline minified critical-path CSS', done => {
        const expected = read('expected/generateInline-minified.html');
        const target = '.generateInline-minified.html';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generateInline.html`,
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should handle multiple calls', done => {
        const expected1 = read('expected/generateInline.html');
        const expected2 = read('expected/generateInline-minified.html');
        const {port} = this;
        async.series({
            first(cb) {
                critical.generate({
                    base: 'fixtures/',
                    src: `http://localhost:${port}/generateInline.html`,
                    inline: true
                }, cb);
            },
            second(cb) {
                critical.generate({
                    base: 'fixtures/',
                    minify: true,
                    src: `http://localhost:${port}/generateInline.html`,
                    inline: true
                }, cb);
            }
        }, (err, results) => {
            assert.isNull(err, Boolean(err) && err);
            assert.strictEqual(nn(results.first), nn(expected1));
            assert.strictEqual(nn(results.second), nn(expected2));
            done();
        });
    });

    it('should inline critical-path CSS handling remote stylesheets', done => {
        const expected = read('expected/generateInline-external-minified2.html');
        const target = '.generateInline-external2.html';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generateInline-external2.html`,
            inlineImages: false,
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS with extract option handling remote stylesheets', done => {
        const expected = read('expected/generateInline-external-extract2.html');
        const target = '.generateInline-external-extract.html';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generateInline-external2.html`,
            inlineImages: false,
            minify: true,
            extract: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS without screwing svg images ', done => {
        const expected = read('expected/generateInline-svg.html');
        const target = '.generateInline-svg.html';

        critical.generate({
            base: 'fixtures/',
            minify: true,
            src: `http://localhost:${this.port}/generateInline-svg.html`,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', done => {
        const expected = read('expected/generateInline-extract.html');
        const target = '.generateInline-extract.html';

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: `http://localhost:${this.port}/generateInline.html`,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should consider "ignore" option', done => {
        const expected = read('expected/generate-ignore.css');
        const target = '.ignore.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-default.html`,
            dest: target,
            ignore: ['@media', '.header', /jumbotron/],

            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle empty "ignore" array', done => {
        const expected = read('expected/generate-default.css', true);
        const target = '.ignore.min.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-default.html`,
            dest: target,
            ignore: [],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle ignore "@font-face"', done => {
        const expected = read('expected/generate-ignorefont.css', true);
        const target = '.ignorefont.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-ignorefont.html`,
            dest: target,
            ignore: ['@font-face'],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should keep styles defined by the `include` option', done => {
        const expected = read('fixtures/styles/include.css');
        const target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/include.html`,
            include: [/someRule/],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should use the provided user agent to get the remote src', done => {
        const expected = read('expected/generate-default.css');
        const target = '.critical.css';

        critical.generate({
            base: 'fixtures/',
            src: `http://localhost:${this.port}/generate-default-useragent.html`,
            include: [/someRule/],
            dest: target,
            width: 1300,
            height: 900,
            userAgent: 'custom agent'
        }, assertCritical(target, expected, done));
    });
});
