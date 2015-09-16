'use strict';
var critical = require('../');
var path = require('path');
var read = require('./helper/testhelper').read;
var assertCritical = require('./helper/testhelper').assertCritical;
var gc = require('../lib/gc');
gc.skipExceptions();

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

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
