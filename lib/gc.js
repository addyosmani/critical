'use strict';

const fs = require('fs-extra');
const exitHook = require('async-exit-hook');
const {uniq} = require('lodash');
const debug = require('debug')('critical:gc');

let files = [];

function cleanup() {
    files = uniq(files);

    if (files.length > 0) {
        debug('cleanup triggered. Unlinking temp files', files);
    }

    return Promise.all(files.map(file => {
        if (fs.existsSync(file)) {
            return fs.unlink(file);
        }

        return Promise.resolve();
    })).then(() => {
        files = [];
    });
}

exitHook(done => cleanup().then(() => done()));
process.on('cleanup', cleanup);

module.exports.cleanup = cleanup;
module.exports.addFile = file => {
    files.push(file);
};
