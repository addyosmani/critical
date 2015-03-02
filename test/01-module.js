'use strict';
var assert = require('chai').assert;
var critical = require('../');

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
});
