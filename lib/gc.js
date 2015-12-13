'use strict';
var _ = require('lodash');
var fs = require('fs');
var debug = require('debug')('critical:gc');
var files = [];
var handleException = true;

function cleanup() {
    files = _.uniq(files);
    if (files.length) {
        debug('cleanup triggered. Unlinking temp files',files);
    }
    _.forEach(files, function (tmpfile) {
        try {
            fs.unlinkSync(tmpfile);
        } catch (err) { /* already removed */ }
    });
    files = [];
}

// attach user callback to the process event emitter
// if no callback, it will still exit gracefully on Ctrl-C
process.on('cleanup', cleanup);

// do app specific cleaning before exiting
process.on('exit', function () {
    process.emit('cleanup');
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
    process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function () {
    return handleException && process.exit(99);
});

module.exports.addFile = function (file) {
    files.push(file);
};


module.exports.skipExceptions = function(){
    handleException = false;
};
