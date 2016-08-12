/* eslint-env node, mocha */
'use strict';
var path = require('path');
var assert = require('chai').assert;
var File = require('vinyl');
var file = require('../lib/file-helper');

// unittests
describe('Lib', function () {
    describe('file.guessBasePath', function () {
        it('should return process.cwd() without base', function (done) {
            var res = file.guessBasePath({});
            assert.strictEqual(res, process.cwd());
            done();
        });

        it('should return base if base option is set', function (done) {
            var res = file.guessBasePath({src: 'fixtures/folder/generate-default.html'});
            assert.strictEqual(res, 'fixtures/folder');
            done();
        });
    });

    describe('file.resolveAssetPaths', function () {
        function html(base, filepath) {
            return new File({
                base: base || 'fixtures',
                path: filepath || 'fixtures/generate-default.html'
            });
        }

        it('should compute path based on file', function (done) {
            var f = file.replaceAssetPaths(html(), {
                base: 'fixtures'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: new Buffer('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(a/b/images/test.png)');

            done();
        });

        it('should compute path based on dest', function (done) {
            var f = file.replaceAssetPaths(html(), {
                base: 'fixtures',
                dest: 'fixtures/1/2/3.html'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: new Buffer('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(../../images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(../../a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../../../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(../../a/b/images/test.png)');

            done();
        });

        it('should compute path based on destFolder', function (done) {
            var f = file.replaceAssetPaths(html(), {
                base: 'fixtures',
                dest: '1/2/3.html',
                destFolder: 'fixtures'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: new Buffer('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(a/b/images/test.png)');

            done();
        });

        it('should compute path based on dest with src outside base', function (done) {
            var f = file.replaceAssetPaths(html('fixtures', path.resolve('expexted/generate-default.html')), {
                base: 'fixtures',
                dest: 'fixtures/1/2.html'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/file.css',
                    contents: new Buffer('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(../../images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(../images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../../../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(../a/images/test.png)');

            done();
        });
    });
});
