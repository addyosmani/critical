/* eslint-env node, mocha */
'use strict';
const path = require('path');
const assert = require('chai').assert;
const async = require('async');
const nn = require('normalize-newline');
const critical = require('../');
const read = require('./helper/testhelper').read;
const readAndRemove = require('./helper/testhelper').readAndRemove;
const assertCritical = require('./helper/testhelper').assertCritical;

process.chdir(path.resolve(__dirname));

describe('Module - generateInline (deprecated)', () => {
    after(() => {
        process.emit('cleanup');
    });
    it('should generate and inline critical-path CSS', done => {
        const expected = read('expected/generateInline.html');
        const target = '.generateInline.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline minified critical-path CSS', done => {
        const expected = read('expected/generateInline-minified.html');
        const target = '.generateInline-minified.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            minify: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should handle multiple calls', done => {
        const expected1 = read('expected/generateInline.html');
        const expected2 = read('expected/generateInline-minified.html');

        async.series({
            first(cb) {
                critical.generateInline({
                    base: 'fixtures/',
                    src: 'generateInline.html'
                }, cb);
            },
            second(cb) {
                critical.generateInline({
                    base: 'fixtures/',
                    minify: true,
                    src: 'generateInline.html'
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
        const target = '.generateInline-external.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS with extract option ignoring remote stylesheets', done => {
        const expected = read('expected/generateInline-external-extract.html');
        const target = '.generateInline-external-extract.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            extract: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS without screwing svg images ', done => {
        const expected = read('expected/generateInline-svg.html');
        const target = '.generateInline-svg.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            src: 'generateInline-svg.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', done => {
        const expected = read('expected/generateInline-extract.html');
        const target = '.generateInline-extract.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: 'generateInline.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS from html source', done => {
        const expected = read('expected/generateInline-extract.html');
        const target = '.generateInline-extract-src.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            extract: true,
            html: read('fixtures/generateInline.html'),
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline critical-path CSS and store css', done => {
        const expected = read('expected/generateInline.html');
        const expectedCss = read('expected/generate-default.css', true);
        const target = '.generateInline.html';
        const styleTarget = '.generateInline.css';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            htmlTarget: target,
            styleTarget
        }, assertCritical(target, expected, () => {
            const styles = readAndRemove(styleTarget, true);
            assert.strictEqual(styles, expectedCss);
            done();
        }));
    });
});
