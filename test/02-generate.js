/* eslint-env node, mocha */
'use strict';
var path = require('path');
var http = require('http');
var nn = require('normalize-newline');
var assert = require('chai').assert;
var async = require('async');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var critical = require('../');
var read = require('./helper/testhelper').read;
var assertCritical = require('./helper/testhelper').assertCritical;

process.chdir(path.resolve(__dirname));

describe('Module - generate', function () {
    after(function () {
        process.emit('cleanup');
    });

    it('should generate critical-path CSS', function (done) {
        var expected = read('expected/generate-default.css');
        var target = path.resolve('.critical.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should throw an error on timeout', function (done) {
        var target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            timeout: 1,
            dest: target,
            width: 1300,
            height: 900
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should generate critical-path CSS with query string in file name', function (done) {
        var expected = read('expected/generate-default.css');
        var target = path.resolve('.critical.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default-querystring.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should ignore stylesheets blocked due to 403', function (done) {
        var expected = '\n';
        var target = path.resolve('.403.css');

        critical.generate({
            base: 'fixtures/',
            src: '403-css.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should ignore stylesheets blocked due to 404', function (done) {
        var expected = '\n';
        var target = path.resolve('.404.css');

        critical.generate({
            base: 'fixtures/',
            src: '404-css.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate multi-dimension critical-path CSS', function (done) {
        var expected = read('expected/generate-adaptive.css', 'utf8');
        var target = path.resolve('.adaptive.css');

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

    it('should generate minified critical-path CSS', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = path.resolve('.critical.min.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS successfully with external css file configured', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = path.resolve('.nostyle.css');

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

    it('should inline relative images', function (done) {
        var expected = read('expected/generate-image.css');
        var target = path.resolve('.image-relative.css');

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

    it('should inline relative images from folder', function (done) {
        var expected = read('expected/generate-image.css');
        var target = path.resolve('.image-relative.css');

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

    it('should rewrite relative images for html outside root', function (done) {
        var expected = read('expected/generate-image-relative.css');
        var target = path.resolve('fixtures/folder/.image-relative.css');

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

    it('should rewrite relative images for html outside root with css file', function (done) {
        var expected = read('expected/generate-image-relative-subfolder.css');
        var target = path.resolve('fixtures/folder/subfolder/.image-relative-subfolder.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/subfolder/generate-image-absolute.html',
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should rewrite relative images for html outside root destFolder option', function (done) {
        var expected = read('expected/generate-image-relative-subfolder.css');
        var target = path.resolve('.image-relative-subfolder.css');

        critical.generate({
            base: 'fixtures/',
            src: 'folder/subfolder/generate-image-absolute.html',
            destFolder: 'folder/subfolder',
           // dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done, true));
    });

    it('should rewrite relative images for html inside root', function (done) {
        var expected = read('expected/generate-image-skip.css');
        var target = path.resolve('.image-relative.css');

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

    it('should inline absolute images', function (done) {
        var expected = read('expected/generate-image.css');
        var target = path.resolve('.image-absolute.css');

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

    it('should skip to big images', function (done) {
        var expected = read('expected/generate-image-big.css');
        var target = path.resolve('.image-big.css');

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

    it('considers "inlineImages" option', function (done) {
        var expected = read('expected/generate-image-skip.css');
        var target = path.resolve('.image-skip.css');

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

    it('should not screw up win32 paths', function (done) {
        var expected = read('expected/generate-image.css');
        var target = path.resolve('.image.css');

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

    it('should respect pathPrefix', function (done) {
        var expected = read('expected/path-prefix.css');
        var target = path.resolve('.path-prefix.css');

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

    it('should detect pathPrefix', function (done) {
        var expected = read('expected/path-prefix.css');
        var target = path.resolve('.path-prefix.css');

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

    it('should generate and inline, if "inline" option is set', function (done) {
        var expected = read('expected/generateInline.html');
        var target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should generate and inline critical-path CSS', function (done) {
        var expected = read('expected/generateInline.html');
        var target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should generate and inline minified critical-path CSS', function (done) {
        var expected = read('expected/generateInline-minified.html');
        var target = '.generateInline-minified.html';

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline.html',
            destFolder: '.',
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(path.join('fixtures', target), expected, done));
    });

    it('should handle multiple calls', function (done) {
        var expected1 = read('expected/generateInline.html');
        var expected2 = read('expected/generateInline-minified.html');

        async.series({
            first: function (cb) {
                critical.generate({
                    base: 'fixtures/',
                    src: 'generateInline.html',
                    inline: true
                }, cb);
            },
            second: function (cb) {
                critical.generate({
                    base: 'fixtures/',
                    minify: true,
                    src: 'generateInline.html',
                    inline: true
                }, cb);
            }
        }, function (err, results) {
            assert.isNull(err, Boolean(err) && err);
            assert.strictEqual(nn(results.first), nn(expected1));
            assert.strictEqual(nn(results.second), nn(expected2));
            done();
        });
    });

    it('should inline critical-path CSS ignoring remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-minified.html');
        var target = path.resolve('.generateInline-external.html');

        critical.generate({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS with extract option ignoring remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-extract.html');
        var target = path.resolve('.generateInline-external-extract.html');

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

    it('should inline critical-path CSS without screwing svg images ', function (done) {
        var expected = read('expected/generateInline-svg.html');
        var target = path.resolve('.generateInline-svg.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            src: 'generateInline-svg.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', function (done) {
        var expected = read('expected/generateInline-extract.html');
        var target = path.resolve('.generateInline-extract.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: 'generateInline.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS from html source', function (done) {
        var expected = read('expected/generateInline-extract.html');
        var target = path.resolve('.generateInline-extract-src.html');

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            html: read('fixtures/generateInline.html'),
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should consider "ignore" option', function (done) {
        var expected = read('expected/generate-ignore.css');
        var target = path.resolve('.ignore.css');

        critical.generate({
            base: 'fixtures/',
            src: 'generate-default.html',
            dest: target,
            ignore: ['@media', '.header', /jumbotron/],

            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle empty "ignore" array', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = '.ignore.min.css';

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

    it('should handle ignore "@font-face"', function (done) {
        var expected = read('expected/generate-ignorefont.css', true);
        var target = '.ignorefont.css';

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

    it('should keep styles defined by the `include` option', function (done) {
        var expected = read('fixtures/styles/include.css');
        var target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: 'include.html',
            include: [/someRule/],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });
});

describe('Module - generate (remote)', function () {
    var server;

    before(function () {
        var serve = serveStatic('fixtures', {index: ['index.html', 'index.htm']});

        server = http.createServer(function (req, res) {
            var done = finalhandler(req, res);
            serve(req, res, done);
        });
        server.listen(3000);
    });

    after(function () {
        server.close();
        process.emit('cleanup');
    });

    it('should generate critical-path CSS', function (done) {
        var expected = read('expected/generate-default.css');
        var target = '.critical.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-default.html',
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate multi-dimension critical-path CSS', function (done) {
        var expected = read('expected/generate-adaptive.css', 'utf8');
        var target = '.adaptive.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-adaptive.html',
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

    it('should generate minified critical-path CSS', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = '.critical.min.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-default.html',
            minify: true,
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate minified critical-path CSS successfully with external css file configured', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = '.nostyle.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-default-nostyle.html',
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

    it('should inline relative images', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image-relative.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline relative images fetched over http', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image-relative.css';

        critical.generate({
            // image could not be fetched locally
            base: './',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true,
            assetPaths: ['http://localhost:3000/', 'http://localhost:3000/styles']
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image-absolute.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images fetched over http', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image-absolute.css';

        critical.generate({
            base: './',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true,
            assetPaths: ['http://localhost:3000/', 'http://localhost:3000/styles']
        }, assertCritical(target, expected, done));
    });

    it('should skip to big images', function (done) {
        var expected = read('expected/generate-image-big.css');
        var target = '.image-big.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-big.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('considers "inlineImages" option', function (done) {
        var expected = read('expected/generate-image-skip.css');
        var target = '.image-skip.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: false
        }, assertCritical(target, expected, done));
    });

    it('should not screw up win32 paths', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-image.html',
            css: [
                'fixtures/styles/some/path/image.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should respect pathPrefix', function (done) {
        var expected = read('expected/path-prefix.css');
        var target = '.path-prefix.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/path-prefix.html',
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            // empty string most likely to candidate for failure if change in code results in checking option lazily,
            pathPrefix: ''
        }, assertCritical(target, expected, done));
    });

    it('should detect pathPrefix', function (done) {
        var expected = read('expected/path-prefix.css');
        var target = '.path-prefix.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/path-prefix.html',
            css: [
                'fixtures/styles/path-prefix.css'
            ],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline, if "inline" option is set', function (done) {
        var expected = read('expected/generateInline.html');
        var target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generateInline.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline critical-path CSS', function (done) {
        var expected = read('expected/generateInline.html');
        var target = '.generateInline.html';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generateInline.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline minified critical-path CSS', function (done) {
        var expected = read('expected/generateInline-minified.html');
        var target = '.generateInline-minified.html';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generateInline.html',
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should handle multiple calls', function (done) {
        var expected1 = read('expected/generateInline.html');
        var expected2 = read('expected/generateInline-minified.html');

        async.series({
            first: function (cb) {
                critical.generate({
                    base: 'fixtures/',
                    src: 'http://localhost:3000/generateInline.html',
                    inline: true
                }, cb);
            },
            second: function (cb) {
                critical.generate({
                    base: 'fixtures/',
                    minify: true,
                    src: 'http://localhost:3000/generateInline.html',
                    inline: true
                }, cb);
            }
        }, function (err, results) {
            assert.isNull(err, Boolean(err) && err);
            assert.strictEqual(nn(results.first), nn(expected1));
            assert.strictEqual(nn(results.second), nn(expected2));
            done();
        });
    });

    it('should inline critical-path CSS handling remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-minified2.html');
        var target = '.generateInline-external2.html';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generateInline-external2.html',
            inlineImages: false,
            minify: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS with extract option handling remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-extract2.html');
        var target = '.generateInline-external-extract.html';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generateInline-external2.html',
            inlineImages: false,
            minify: true,
            extract: true,
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS without screwing svg images ', function (done) {
        var expected = read('expected/generateInline-svg.html');
        var target = '.generateInline-svg.html';

        critical.generate({
            base: 'fixtures/',
            minify: true,
            src: 'http://localhost:3000/generateInline-svg.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', function (done) {
        var expected = read('expected/generateInline-extract.html');
        var target = '.generateInline-extract.html';

        critical.generate({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: 'http://localhost:3000/generateInline.html',
            dest: target,
            inline: true
        }, assertCritical(target, expected, done));
    });

    it('should consider "ignore" option', function (done) {
        var expected = read('expected/generate-ignore.css');
        var target = '.ignore.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-default.html',
            dest: target,
            ignore: ['@media', '.header', /jumbotron/],

            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle empty "ignore" array', function (done) {
        var expected = read('expected/generate-default.css', true);
        var target = '.ignore.min.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-default.html',
            dest: target,
            ignore: [],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should handle ignore "@font-face"', function (done) {
        var expected = read('expected/generate-ignorefont.css', true);
        var target = '.ignorefont.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/generate-ignorefont.html',
            dest: target,
            ignore: ['@font-face'],
            minify: true,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });

    it('should keep styles defined by the `include` option', function (done) {
        var expected = read('fixtures/styles/include.css');
        var target = '.include.css';

        critical.generate({
            base: 'fixtures/',
            src: 'http://localhost:3000/include.html',
            include: [/someRule/],
            dest: target,
            width: 1300,
            height: 900
        }, assertCritical(target, expected, done));
    });
});
