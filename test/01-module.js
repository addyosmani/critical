/* eslint-env node, mocha */
'use strict';
const assert = require('chai').assert;
const critical = require('../');

describe('Module', () => {
    it('should call callback method with an error on generating if src and base not specified', done => {
        const tmp = critical.generate({}, (err, data) => {
            assert.notOk(data);
            assert.instanceOf(err, Error);
            done();
        });

        assert.isUndefined(tmp);
    });

    it('should return rejected Promise for generating without callback if src and dest not specified', done => {
        const tmp = critical.generate({}).then(data => {
            assert.fail(data, undefined, 'Should not be called');
        }).catch(err => {
            assert.instanceOf(err, Error);
            done();
        });

        assert.isDefined(tmp);
    });

    it('should call callback method with an error on generateInline if src and base not specified', done => {
        const tmp = critical.generateInline({}, (err, data) => {
            assert.notOk(data);
            assert.instanceOf(err, Error);
            done();
        });

        assert.isUndefined(tmp);
    });

    it('should return rejected Promise for generateInline without callback if src and dest not specified', done => {
        const tmp = critical.generateInline({}).then(data => {
            assert.fail(data, undefined, 'Should not be called');
        }).catch(err => {
            assert.instanceOf(err, Error);
            done();
        });

        assert.isDefined(tmp);
    });

    it('throws on inlining if src and dest not specified', () => {
        assert.throws(() => {
            critical.inline({});
        });
    });
});
