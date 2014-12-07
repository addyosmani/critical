/*
 Unit tests for Critical.

 Note: At present, our tests will pass on Unix based systems but fail on
 Windows. This is a known issue to do with line-endings which we hope to
 address in the very near future.
 */
'use strict';
var fs = require('fs');
var assert = require('assert');
var async = require('async');
var critical = require('../src/critical');
var path = require('path');
var execFile = require('child_process').execFile;
var pkg = require('../package.json');
var mockery = require('mockery');

process.setMaxListeners(0);
process.chdir('test');

/**
 * Strip whitespaces, tabs and newlines and replace with one space.
 * Usefull when comparing string contents.
 * @param string
 */
function stripWhitespace(string) {
    return string.replace(/[\r\n]+/mg, ' ').replace(/\s+/gm, '');
}

/* globals describe,it, beforeEach, afterEach */
describe('Module', function () {

    it('throws on CSS generation if src and dest not specified', function () {
        assert.throws(function () {
            critical.generate({});
        });
    });

    it('throws on inlining if src and dest not specified', function () {
        assert.throws(function () {
            critical.inline({});
        });
    });

    it('generates critical-path CSS successfully', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index.html',
            dest: 'styles/critical.css',
            width: 320,
            height: 70
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('generates minified critical-path CSS successfully', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-min.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index.html',
            minify: true,
            width: 320,
            height: 70
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('generates minified critical-path CSS successfully with external css file configured', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-min.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index.html',
            css: [
                'external/styles/main.css',
                'fixture/bower_components/bootstrap/dist/css/bootstrap.css',
                'fixture/styles/unused.css'
            ],
            minify: true,
            width: 320,
            height: 70
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('generates critical-path CSS without writing to disk', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-pregenerated.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index.html',
            width: 320,
            height: 70
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('inlines critical-path CSS successfully', function (done) {
        var expected = fs.readFileSync('fixture/index-final.html', 'utf8');

        critical.inline({
            base: 'fixture/',
            src: 'index-critical.html',
            dest: 'test-final.html'
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('inlines critical-path CSS without writing to disk', function (done) {
        var expected = fs.readFileSync('fixture/index-test.html', 'utf8');

        critical.inline({
            base: 'fixture/',
            src: 'index-critical.html'
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('inlines and minified critical-path CSS', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-minified.html', 'utf8');

        critical.inline({
            base: 'fixture/',
            minify: true,
            src: 'index-critical.html',
            dest: 'test-inlined-minified.html'
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('inlines and minified critical-path CSS and consider "inlineImages" option', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-noimage-minified.html', 'utf8');

        critical.inline({
            base: 'fixture/',
            minify: true,
            src: 'index-critical-image.html',
            dest: 'test-inlined-noimage-minified.html',
            inlineImages: false
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });


    it('ganerates and inlines critical-path CSS successfully', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-async-final.html', 'utf8');

        critical.generateInline({
            base: 'fixture/',
            src: 'index.html',
            htmlTarget: 'test-inlined-async-final.html'
        }, function (err, output) {
            var out = fs.readFileSync('fixture/test-inlined-async-final.html', 'utf8');
            assert.strictEqual(stripWhitespace(out), stripWhitespace(expected));
            done();
        });
    });

    it('inlines critical-path CSS without writing to disk', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-async-final.html', 'utf8');
        critical.generateInline({
            base: 'fixture/',
            src: 'index.html',
            inlineImages: false,
            dest: 'test-inlined-inlined-async-final.html'
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('inlines and minified critical-path CSS', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-async-minified-final.html', 'utf8');

        critical.generateInline({
            base: 'fixture/',
            minify: true,
            src: 'index.html',
            htmlTarget: 'test-inlined-async-minified-final.html'
        }, function (err, output) {
            var out = fs.readFileSync('fixture/test-inlined-async-minified-final.html', 'utf8');
            assert.strictEqual(stripWhitespace(out), stripWhitespace(expected));
            done();
        });
    });


    it('inlines and critical-path CSS and relative images', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-image-expected.css', 'utf8');
        critical.generate({
            base: 'fixture/',
            src: 'index-image.html',
            width: 320,
            height: 70,
            inlineImages: true
        }, function (err, output) {
            if (err) {
                assert.fail(err);
            } else {
                assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            }
            done();
        });
    });

    it('inlines and critical-path CSS and absolute images', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-image-absolute-expected.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index-image-absolute.html',
            width: 320,
            height: 70,
            inlineImages: true
        }, function (err, output) {
            if (err) {
                assert.fail(err);
            } else {
                assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            }
            done();
        });
    });


    it('inlines and critical-path CSS and skips to big images', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-image-big-expected.css', 'utf8');

        critical.generate({
            base: 'fixture/',
            src: 'index-image-big.html',
            width: 320,
            height: 70,
            inlineImages: true
        }, function (err, output) {
            if (err) {
                assert.fail(err);
            } else {
                assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            }
            done();
        });
    });

    it('considers "inlineImages" option', function (done) {
        var expected = fs.readFileSync('fixture/styles/critical-skip-images-expected.css', 'utf8');
        critical.generate({
            base: 'fixture/',
            src: 'index-image.html',
            width: 320,
            height: 70,
            inlineImages: false
        }, function (err, output) {
            if (err) {
                assert.fail(err);
            } else {
                assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            }
            done();
        });
    });

    it('handles parallel calls', function (done) {
        var expected1 = fs.readFileSync('fixture/index-inlined-async-final.html', 'utf8');
        var expected2 = fs.readFileSync('fixture/index-inlined-async-minified-final.html', 'utf8');

        async.parallel({
            first: function (cb) {
                critical.generateInline({
                    base: 'fixture/',
                    src: 'index.html'
                }, cb);
            },
            second: function (cb) {
                critical.generateInline({
                    base: 'fixture/',
                    minify: true,
                    src: 'index.html'
                }, cb);
            }
        }, function (err, results) {
            assert.strictEqual(stripWhitespace(results.first), stripWhitespace(expected1));
            assert.strictEqual(stripWhitespace(results.second), stripWhitespace(expected2));
            done();
        });
    });

    it('inlines critical-path CSS ignoring remote stylesheets', function (done) {
        var expected = fs.readFileSync('fixture/index-external-inlined-async-final.html', 'utf8');
        critical.generateInline({
            base: 'fixture/',
            src: 'index-external.html',
            inlineImages: false
        }, function (err, output) {
            assert.strictEqual(stripWhitespace(output), stripWhitespace(expected));
            done();
        });
    });

    it('does not screw up width win32 paths', function (done) {
        critical.generate({
            base: 'fixture/',
            src: 'index-image-path.html',
            inlineImages: false
        }, function (err, output) {
            assert.strictEqual(
                stripWhitespace(output),
                stripWhitespace('.header{ background: transparent url(\'/images/critical.png\'); }')
            );
            done();
        });
    });

    it('inlines and extracts critical-path CSS', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-async-extracted-final.html', 'utf8');

        critical.generateInline({
            base: 'fixture/',
            minify: true,
            extract: true,
            src: 'index.html',
            htmlTarget: 'test-inlined-async-extracted-final.html'
        }, function (err, output) {
            var out = fs.readFileSync('fixture/test-inlined-async-extracted-final.html', 'utf8');
            assert.strictEqual(stripWhitespace(out), stripWhitespace(expected));
            done();
        });
    });

    it('inlines and extracts critical-path CSS from html source', function (done) {
        var expected = fs.readFileSync('fixture/index-inlined-async-extracted-final.html', 'utf8');

        critical.generateInline({
            base: 'fixture/',
            minify: true,
            extract: true,
            html: fs.readFileSync('fixture/index.html'),
            htmlTarget: 'test-inlined-async-extracted-final.html'
        }, function (err, output) {
            var out = fs.readFileSync('fixture/test-inlined-async-extracted-final.html', 'utf8');
            assert.strictEqual(stripWhitespace(out), stripWhitespace(expected));
            done();
        });
    });
});

// binary
describe('CLI', function () {

    describe('acceptance', function () {
        it('should return the version', function (done) {
            var cp = execFile('node', [path.join(__dirname, '../', pkg.bin.critical), '--version', '--no-update-notifier']);
            var expected = pkg.version;

            cp.stdout.on('data', function (data) {
                assert.strictEqual(data.replace(/\r\n|\n/g, ''), expected);
                done();
            });
        });


        it('should work well with the critical CSS file passed as an option', function (done) {
            var cp = execFile('node', [
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html',
                '--base', 'fixture',
                '--width', '320',
                '--height', '70'
            ]);

            var expected = fs.readFileSync('fixture/styles/critical.css', 'utf8');
            cp.stdout.on('data', function (data) {
                fs.writeFileSync('tmp.cli.css', data);
                assert.strictEqual(stripWhitespace(data), stripWhitespace(expected));
                done();
            });
        });
    });
    describe('mocked', function () {
        beforeEach(function () {
            this.origArgv = process.argv;
            this.origExit = process.exit;

            mockery.enable({
                warnOnUnregistered: false,
                useCleanCache: true
            });

            mockery.registerMock('../src/critical', {
                generate: function (opts) {
                    this.mockOpts = opts;
                    this.method = 'generate';
                }.bind(this),
                generateInline: function (opts) {
                    this.mockOpts = opts;
                    this.method = 'generateInline';
                }.bind(this)
            });
        });

        afterEach(function () {
            mockery.deregisterAll();
            mockery.disable();
            process.argv = this.origArgv;
            process.exit = this.origExit;
        });

        it('should pass the correct opts when using short opts', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html',
                '-c', 'css',
                '-w', '300',
                '-h', '400',
                '-H', 'htmlTarget',
                '-S', 'styleTarget',
                '-m', 'minify',
                '-e', 'extract'
            ];

            require('../bin/critical');

            assert.strictEqual(this.mockOpts.width,300);
            assert.strictEqual(this.mockOpts.height,400);
            assert.strictEqual(this.mockOpts.css,'css');
            assert.strictEqual(this.mockOpts.htmlTarget,'htmlTarget');
            assert.strictEqual(this.mockOpts.styleTarget,'styleTarget');
            assert.strictEqual(this.mockOpts.minify,'minify');
            assert.strictEqual(this.mockOpts.extract,'extract');
        });

        it('should pass the correct opts when using long opts', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html',
                '--css', 'css',
                '--width', '300',
                '--height', '400',
                '--htmlTarget', 'htmlTarget',
                '--styleTarget', 'styleTarget',
                '--minify', 'minify',
                '--extract', 'extract'
            ];

            require('../bin/critical');

            assert.strictEqual(this.mockOpts.width,300);
            assert.strictEqual(this.mockOpts.height,400);
            assert.strictEqual(this.mockOpts.css,'css');
            assert.strictEqual(this.mockOpts.htmlTarget,'htmlTarget');
            assert.strictEqual(this.mockOpts.styleTarget,'styleTarget');
            assert.strictEqual(this.mockOpts.minify,'minify');
            assert.strictEqual(this.mockOpts.extract,'extract');
        });

        it('should use "generateInline" when passing htmltarget', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html',
                '--htmlTarget', 'htmlTarget'
            ];

            require('../bin/critical');

            assert.strictEqual(this.method,'generateInline');
        });

        it('should use "generate" when not passing htmltarget', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html'
            ];

            require('../bin/critical');

            assert.strictEqual(this.method,'generate');
        });

        it('should rewrite "styleTarget" to "dest" when using "generate"', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', pkg.bin.critical),
                'fixture/index.html',
                '--styleTarget', 'styleTarget'
            ];

            require('../bin/critical');

            assert.strictEqual(this.method,'generate');
            assert.strictEqual(this.mockOpts.dest,'styleTarget');
        });
    });
});
