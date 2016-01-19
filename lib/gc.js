'use strict';
var _ = require('lodash');
var fs = require('fs');
var debug = require('debug')('critical:gc');
var files = [];
var handleException = true;

function cleanup() {
    files = _.uniq(files);
    if (files.length) {
        debug('cleanup triggered. Unlinking temp files', files);
    }
    _.forEach(files, function (tmpfile) {
        try {
            fs.unlinkSync(tmpfile);
        } catch (err) {
            // already removed
        }
    });
    files = [];
}

function onExit() {
    process.emit('cleanup');
    process.removeListener('cleanup', cleanup);
    process.removeListener('uncaughtException', onException);
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('exit', onExit);
}

function onSigInt() {
    process.exit(2);
}

function onException() {
    return handleException && process.exit(99);
}

process.on('SIGINT', onSigInt);
process.on('cleanup', cleanup);
process.on('exit', onExit);
process.on('uncaughtException', onException);

module.exports.addFile = function (file) {
    files.push(file);
};

module.exports.skipExceptions = function () {
    handleException = false;
};
