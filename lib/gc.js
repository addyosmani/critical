'use strict';
var fs = require('fs');
var _ = require('lodash');
var debug = require('debug')('critical:gc');
var files = [];

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
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('exit', onExit);
}

function onSigInt() {
    process.exit(2);
}
process.on('SIGINT', onSigInt);
process.on('cleanup', cleanup);
process.on('exit', onExit);

module.exports.addFile = function (file) {
    files.push(file);
};
