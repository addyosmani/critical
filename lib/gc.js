'use strict';

const fs = require('fs-extra');
const exitHook = require('async-exit-hook');
const debug = require('debug')('critical:gc');

const files = new Set();

function cleanup() {
    if (files.size > 0) {
        debug('cleanup triggered. Unlinking temp files', files);
    }

    return Promise.all([...files].map(file => {
        if (fs.existsSync(file)) {
            return fs.unlink(file);
        }

        return Promise.resolve();
    })).then(() => {
        files.clear();
    });
}

exitHook(done => cleanup().then(() => done()));
process.on('cleanup', cleanup);

module.exports.cleanup = cleanup;
module.exports.addFile = file => {
    files.add(file);
};
