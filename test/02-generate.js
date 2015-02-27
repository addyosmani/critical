'use strict';
var critical = require('../');
var path = require('path');
var read = require('./helper/testhelper').read;
var assertCritical = require('./helper/testhelper').assertCritical;

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

describe('Module - generate', function () {

    it('should generate critical-path CSS', function (done) {
        var expected = read('expected/generate-default.css');
        var target = '.critical.css';

        critical.generate({
            base: 'fixtures/',
            src: 'default.html',
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
            src: 'adaptive.html',
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
            src: 'default.html',
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
            src: 'default-nostyle.html',
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
            src: 'image.html',
            css: [
                'fixtures/styles/image-relative.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should inline absolute images', function (done) {
        var expected = read('expected/generate-image.css');
        var target = '.image-absolute.css';

        critical.generate({
            base: 'fixtures/',
            src: 'image.html',
            css: [
                'fixtures/styles/image-absolute.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));
    });

    it('should skip to big images', function (done) {
        var expected = read('expected/generate-image-big.css');
        var target = '.image-big.css';

        critical.generate({
            base: 'fixtures/',
            src: 'image.html',
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
            src: 'image.html',
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
            src: 'image.html',
            css: [
                'fixtures/styles/some/path/image.css'
            ],
            dest: target,
            width: 1300,
            height: 900,
            inlineImages: true
        }, assertCritical(target, expected, done));


    });
});
