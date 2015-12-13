'use strict';
var assert = require('chai').assert;
var async = require('async');
var critical = require('../');
var path = require('path');
var read = require('./helper/testhelper').read;
var readAndRemove = require('./helper/testhelper').readAndRemove;
var assertCritical = require('./helper/testhelper').assertCritical;
var nn = require('normalize-newline');
var gc = require('../lib/gc');
gc.skipExceptions();

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

describe('Module - generateInline (deprecated)', function () {
    after(function(){
        process.emit('cleanup');
    });
    it('should generate and inline critical-path CSS', function (done) {
        var expected = read('expected/generateInline.html');
        var target = '.generateInline.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline minified critical-path CSS', function (done) {
        var expected = read('expected/generateInline-minified.html');
        var target = '.generateInline-minified.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            minify: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should handle multiple calls', function (done) {
        var expected1 = read('expected/generateInline.html');
        var expected2 = read('expected/generateInline-minified.html');

        async.series({
            first: function (cb) {
                critical.generateInline({
                    base: 'fixtures/',
                    src: 'generateInline.html'
                }, cb);
            },
            second: function (cb) {
                critical.generateInline({
                    base: 'fixtures/',
                    minify: true,
                    src: 'generateInline.html'
                }, cb);
            }
        }, function (err, results) {
            assert.strictEqual(nn(results.first), nn(expected1));
            assert.strictEqual(nn(results.second), nn(expected2));
            done();
        });
    });

    it('should inline critical-path CSS ignoring remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-minified.html');
        var target = '.generateInline-external.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });


    it('should inline critical-path CSS with extract option ignoring remote stylesheets', function (done) {
        var expected = read('expected/generateInline-external-extract.html');
        var target = '.generateInline-external-extract.html';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline-external.html',
            inlineImages: false,
            minify: true,
            extract: true,
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline critical-path CSS without screwing svg images ', function (done) {
        var expected = read('expected/generateInline-svg.html');
        var target = '.generateInline-svg.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            src: 'generateInline-svg.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS', function (done) {
        var expected = read('expected/generateInline-extract.html');
        var target = '.generateInline-extract.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            extract: true,
            src: 'generateInline.html',
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should inline and extract critical-path CSS from html source', function (done) {
        var expected = read('expected/generateInline-extract.html');
        var target = '.generateInline-extract-src.html';

        critical.generateInline({
            base: 'fixtures/',
            minify: true,
            extract: true,
            html: read('fixtures/generateInline.html'),
            htmlTarget: target
        }, assertCritical(target, expected, done));
    });

    it('should generate and inline critical-path CSS and store css', function (done) {
        var expected = read('expected/generateInline.html');
        var expectedCss = read('expected/generate-default.css',true);
        var target = '.generateInline.html';
        var styleTarget = '.generateInline.css';

        critical.generateInline({
            base: 'fixtures/',
            src: 'generateInline.html',
            htmlTarget: target,
            styleTarget: styleTarget
        }, assertCritical(target, expected, function(){
            var styles = readAndRemove(styleTarget,true);
            assert.strictEqual(styles, expectedCss);
            done();
        }));
    });

});
