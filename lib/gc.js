'use strict';
const fs = require('fs');
const _ = require('lodash');
const debug = require('debug')('critical:gc');

let files = [];

function cleanup() {
    files = _.uniq(files);
    if (files.length > 0) {
        debug('cleanup triggered. Unlinking temp files', files);
    }
    _.forEach(files, tmpfile => {
        try {
            fs.unlinkSync(tmpfile);
        } catch (err) {
            // Already removed
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
    process.exit(2);    // eslint-disable-line unicorn/no-process-exit
}
process.on('SIGINT', onSigInt);
process.on('cleanup', cleanup);
process.on('exit', onExit);

module.exports.addFile = function (file) {
    files.push(file);
};
