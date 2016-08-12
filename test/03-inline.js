/* eslint-env node, mocha */
'use strict';
var path = require('path');
var critical = require('../');
var read = require('./helper/testhelper').read;
var assertCritical = require('./helper/testhelper').assertCritical;

process.chdir(path.resolve(__dirname));

describe('Module - inline (deprecated)', function () {
    it('inlines critical-path CSS successfully', function (done) {
        var expected = read('expected/inline.html');
        var target = '.inline.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline.html',
            dest: target
        }, assertCritical(target, expected, done));
    });

    it('inlines and minified critical-path CSS', function (done) {
        var expected = read('expected/inline-minified.html');
        var target = '.inline-minified.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline.html',
            dest: target,
            minify: true
        }, assertCritical(target, expected, done));
    });

    it('inlines and minified critical-path CSS and consider "inlineImages" option', function (done) {
        var expected = read('expected/inline-image.html');
        var target = '.inline-image.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline-image.html',
            dest: target,
            minify: true
        }, assertCritical(target, expected, done));
    });
});
