/* eslint-env node, mocha */
'use strict';
const path = require('path');
const assert = require('chai').assert;
const File = require('vinyl');
const file = require('../lib/file-helper');

// Unittests
describe('Lib', () => {
    describe('file.guessBasePath', () => {
        it('should return process.cwd() without base', done => {
            const res = file.guessBasePath({});
            assert.strictEqual(res, process.cwd());
            done();
        });

        it('should return base if base option is set', done => {
            const res = file.guessBasePath({src: 'fixtures/folder/generate-default.html'});
            assert.strictEqual(res, 'fixtures/folder');
            done();
        });
    });

    describe('file.resolveAssetPaths', () => {
        function html(base, filepath) {
            return new File({
                base: base || 'fixtures',
                path: filepath || 'fixtures/generate-default.html'
            });
        }

        it('should compute path based on file', done => {
            const f = file.replaceAssetPaths(html(), {
                base: 'fixtures'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: Buffer.from('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(a/b/images/test.png)');

            done();
        });

        it('should compute path based on dest', done => {
            const f = file.replaceAssetPaths(html(), {
                base: 'fixtures',
                dest: 'fixtures/1/2/3.html'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: Buffer.from('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(../../images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(../../a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../../../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(../../a/b/images/test.png)');

            done();
        });

        it('should compute path based on destFolder', done => {
            const f = file.replaceAssetPaths(html(), {
                base: 'fixtures',
                dest: '1/2/3.html',
                destFolder: 'fixtures'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/b/file.css',
                    contents: Buffer.from('url(' + p + ')')
                });
            }

            assert.strictEqual(f(mock('../../images/test.png')).contents.toString(), 'url(images/test.png)');
            assert.strictEqual(f(mock('../images/test.png')).contents.toString(), 'url(a/images/test.png)');
            assert.strictEqual(f(mock('../../../images/test.png')).contents.toString(), 'url(../images/test.png)');
            assert.strictEqual(f(mock('images/test.png')).contents.toString(), 'url(a/b/images/test.png)');

            done();
        });

        it('should compute path based on dest with src outside base', done => {
            const f = file.replaceAssetPaths(html('fixtures', path.resolve('expexted/generate-default.html')), {
                base: 'fixtures',
                dest: 'fixtures/1/2.html'
            });

            function mock(p) {
                return new File({
                    path: 'fixtures/a/file.css',
                    contents: Buffer.from('url(' + p + ')')
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
