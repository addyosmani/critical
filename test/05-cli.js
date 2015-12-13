'use strict';
var assert = require('chai').assert;
var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var fs = require('fs');
var mockery = require('mockery');
var path = require('path');
var readJson = require('read-package-json');
var nn = require('normalize-newline');
var skipWin = process.platform === 'win32' ? it.skip : it;
var gc = require('../lib/gc');
gc.skipExceptions();

var finalhandler = require('finalhandler');
var http = require('http');
var serveStatic = require('serve-static');

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

describe('CLI', function () {

    beforeEach(function(done){
        readJson('../package.json',function(err,data){
            this.pkg = data;
            done();
        }.bind(this));
    });

    after(function(){
        process.emit('cleanup');
    });

    describe('acceptance', function () {
        // empty stdout on appveyor? runs correct on manual test with Windows 7
        skipWin('should return the version', function (done) {
            execFile('node', [path.join(__dirname, '../', this.pkg.bin.critical), '--version', '--no-update-notifier'], function(error, stdout){
                assert.strictEqual(stdout.replace(/\r\n|\n/g, ''), this.pkg.version);
                done();
            }.bind(this));
        });

        it('should work well with the critical CSS file passed as an option', function (done) {
            var cp = execFile('node', [
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--base', 'fixtures',
                '--width', '1300',
                '--height', '900'
            ]);

            var expected = fs.readFileSync(path.join(__dirname,'expected/generate-default.css'), 'utf8');
            cp.stdout.on('data', function (data) {
                assert.strictEqual(nn(data), nn(expected));
                done();
            });
        });

        // pipes don't work on windows
        skipWin('should work well with the critical CSS file piped to critical', function (done) {
            var cp = exec('cat fixtures/generate-default.html | node ' + path.join(__dirname, '../', this.pkg.bin.critical) + ' --base fixtures --width 1300 --height 900');

            var expected = fs.readFileSync(path.join(__dirname,'expected/generate-default.css'), 'utf8');
            cp.stdout.on('data', function (data) {
                assert.strictEqual(nn(data), nn(expected));
                done();
            });
        });

        it('should exit with code 1 and show help', function (done) {
            execFile('node', [path.join(__dirname, '../', this.pkg.bin.critical), 'fixtures/not-exists.html'], function(err, stdout, stderr){
                assert.typeOf(err,'Error');
                assert.strictEqual(err.code,1);
                assert.include(stderr, 'Usage:');
                done();
            });
        });
    });

    describe('acceptance (remote)', function () {
        var server;

        before(function(){
            var serve = serveStatic('fixtures', {'index': ['generate-default.html']});

            server = http.createServer(function(req, res){
                var done = finalhandler(req, res);
                serve(req, res, done);
            });
            server.listen(3000);
        });

        after(function(){
            server.close();
        });

        it('should generate critical path css from external resource', function(done){
            var cp = execFile('node', [
                path.join(__dirname, '../', this.pkg.bin.critical),
                'http://localhost:3000',
                '--base', 'fixtures',
                '--width', '1300',
                '--height', '900'
            ]);

            var expected = fs.readFileSync(path.join(__dirname,'expected/generate-default.css'), 'utf8');
            cp.stdout.on('data', function (data) {
                assert.strictEqual(nn(data), nn(expected));
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

            mockery.registerMock('./', {
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
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '-c', 'css',
                '-w', '300',
                '-h', '400',
                '-H', 'htmlTarget',
                '-S', 'styleTarget',
                '-m', 'minify',
                '-e', 'extract',
                '-p', 'pathPrefix',
                '-I', '/ignore/',
                '-i'
            ];

            require('../cli');

            assert.strictEqual(this.mockOpts.width, 300);
            assert.strictEqual(this.mockOpts.height, 400);
            assert.strictEqual(this.mockOpts.css, 'css');
            assert.strictEqual(this.mockOpts.htmlTarget, 'htmlTarget');
            assert.strictEqual(this.mockOpts.styleTarget, 'styleTarget');
            assert.strictEqual(this.mockOpts.minify, 'minify');
            assert.strictEqual(this.mockOpts.extract, 'extract');
            assert.strictEqual(this.mockOpts.pathPrefix, 'pathPrefix');
            assert.isArray(this.mockOpts.ignore);
            assert.instanceOf(this.mockOpts.ignore[0],RegExp);
            assert.strictEqual(this.mockOpts.inline, true);
        });

        it('should pass the correct opts when using long opts', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--css', 'css',
                '--width', '300',
                '--height', '400',
                '--ignore', 'ignore',
                '--htmlTarget', 'htmlTarget',
                '--styleTarget', 'styleTarget',
                '--minify', 'minify',
                '--extract', 'extract',
                '--pathPrefix', 'pathPrefix',
                '--inline',
                '--inlineImages',
                '--maxFileSize', '1024',
                '--assetPaths', 'assetPath1',
                '--assetPaths', 'assetPath2'
            ];

            require('../cli');

            assert.strictEqual(this.mockOpts.width, 300);
            assert.strictEqual(this.mockOpts.height, 400);
            assert.strictEqual(this.mockOpts.css, 'css');
            assert.strictEqual(this.mockOpts.htmlTarget, 'htmlTarget');
            assert.strictEqual(this.mockOpts.styleTarget, 'styleTarget');
            assert.strictEqual(this.mockOpts.minify, 'minify');
            assert.strictEqual(this.mockOpts.extract, 'extract');
            assert.strictEqual(this.mockOpts.pathPrefix, 'pathPrefix');
            assert.isArray(this.mockOpts.ignore);
            assert.include(this.mockOpts.ignore,'ignore');
            assert.strictEqual(this.mockOpts.inline, true);
            assert.strictEqual(this.mockOpts.inlineImages, true);
            assert.isArray(this.mockOpts.assetPaths);
            assert.include(this.mockOpts.assetPaths,'assetPath1');
            assert.include(this.mockOpts.assetPaths,'assetPath2');
            assert.strictEqual(this.mockOpts.maxFileSize, 1024);

        });

        it('should set inline to false when prefixed with --no', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--no-inline'
            ];

            require('../cli');

            assert.strictEqual(this.mockOpts.inline, false);
        });

        it('should set inline to false when passing a falsy value', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '-i', '0'
            ];

            require('../cli');

            assert.strictEqual(this.mockOpts.inline, false);
        });

        it('should use "generateInline" when passing htmltarget', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--htmlTarget', 'htmlTarget'
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generateInline');
        });

        it('should use "generate" when not passing htmltarget', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html'
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generate');
        });

        it('should use "generateInline" when passing --inline', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--inline', 'htmlTarget'
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generateInline');
        });

        it('should use "generate" when not passing --inline', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html'
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generate');
        });

        it('should use "generate" when not passing falsy value for --inline', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--inline', false
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generate');
        });

        it('should rewrite "styleTarget" to "dest" when using "generate"', function () {
            process.argv = [
                'node',
                path.join(__dirname, '../', this.pkg.bin.critical),
                'fixtures/generate-default.html',
                '--styleTarget', 'styleTarget'
            ];

            require('../cli');

            assert.strictEqual(this.method, 'generate');
            assert.strictEqual(this.mockOpts.dest, 'styleTarget');
        });
    });
});
