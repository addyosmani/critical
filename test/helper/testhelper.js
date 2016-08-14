// Some test helper
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('chai').assert;
var CleanCSS = require('clean-css');
var nn = require('normalize-newline');

function readAndRemove(file, minify) {
    var testBase = path.join(__dirname, '..');
    if (!path.isAbsolute(file) && fs.existsSync(path.join(testBase, file))) {
        file = path.join(testBase, file);
    } else if (!path.isAbsolute(file) && fs.existsSync(path.join(testBase, 'fixtures', file))) {
        file = path.join(testBase, 'fixtures', file);
    }

    var content = read(file, minify);
    fs.unlinkSync(file);

    return content;
}

function read(file, minify) {
    var content = '';
    if (path.isAbsolute(file)) {
        content = fs.readFileSync(file, 'utf8');
    } else {
        content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    }
    return minify ? new CleanCSS().minify(content).styles : nn(content);
}

/**
 * Do some tests on the result
 * @param target
 * @param expected
 * @param done
 * @returns {Function}
 */
function assertCritical(target, expected, done, skipTarget) {
    return function (err, output) {
        assert.isNull(err, Boolean(err) && err);
        assert.isDefined(output, 'Should produce output');

        if (!skipTarget) {
            var dest = readAndRemove(target);
            assert.strictEqual(nn(dest), nn(expected));
        }
        assert.strictEqual(nn(output), nn(expected));

        done();
    };
}

module.exports = {
    assertCritical: assertCritical,
    read: read,
    readAndRemove: readAndRemove
};
