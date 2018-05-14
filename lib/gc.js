'use strict';
const fs = require('fs');
const exitHook = require('exit-hook');
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

exitHook(() => cleanup());
process.on('cleanup', cleanup);

module.exports.cleanup = cleanup;
module.exports.addFile = function (file) {
    files.push(file);
};
