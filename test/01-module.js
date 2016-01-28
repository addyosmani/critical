/* eslint-env node, mocha */
'use strict';
var assert = require('chai').assert;
var critical = require('../');

describe('Module', function () {
    it('should call callback method with an error on generating if src and base not specified', function (done) {
        var tmp = critical.generate({}, function (err, data) {
            assert.notOk(data);
            assert.instanceOf(err, Error);
            done();
        });

        assert.isUndefined(tmp);
    });

    it('should return rejected Promise for generating without callback if src and dest not specified', function (done) {
        var tmp = critical.generate({}).then(function (data) {
            assert.fail(data, undefined, 'Should not be called');
        }).catch(function (err) {
            assert.instanceOf(err, Error);
            done();
        });

        assert.isDefined(tmp);
    });

    it('should call callback method with an error on generateInline if src and base not specified', function (done) {
        var tmp = critical.generateInline({}, function (err, data) {
            assert.notOk(data);
            assert.instanceOf(err, Error);
            done();
        });

        assert.isUndefined(tmp);
    });

    it('should return rejected Promise for generateInline without callback if src and dest not specified', function (done) {
        var tmp = critical.generateInline({}).then(function (data) {
            assert.fail(data, undefined, 'Should not be called');
        }).catch(function (err) {
            assert.instanceOf(err, Error);
            done();
        });

        assert.isDefined(tmp);
    });

    it('throws on inlining if src and dest not specified', function () {
        assert.throws(function () {
            critical.inline({});
        });
    });
});
