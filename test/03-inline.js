/* eslint-env node, mocha */
'use strict';
const path = require('path');
const critical = require('../');
const read = require('./helper/testhelper').read;
const assertCritical = require('./helper/testhelper').assertCritical;

process.chdir(path.resolve(__dirname));

describe('Module - inline (deprecated)', () => {
    it('inlines critical-path CSS successfully', done => {
        const expected = read('expected/inline.html');
        const target = '.inline.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline.html',
            dest: target
        }, assertCritical(target, expected, done));
    });

    it('inlines and minified critical-path CSS', done => {
        const expected = read('expected/inline-minified.html');
        const target = '.inline-minified.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline.html',
            dest: target,
            minify: true
        }, assertCritical(target, expected, done));
    });

    it('inlines and minified critical-path CSS and consider "inlineImages" option', done => {
        const expected = read('expected/inline-image.html');
        const target = '.inline-image.html';

        critical.inline({
            base: 'fixtures/',
            src: 'inline-image.html',
            dest: target,
            minify: true
        }, assertCritical(target, expected, done));
    });
});
