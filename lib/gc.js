'use strict';
var _ = require('lodash');
var fs = require('fs');
var files = [];

function cleanup() {
    _.forEach(files, function(tmpfile){
         try {
             fs.unlinkSync(tmpfile);
         } catch (err) { /* already removed */ }
    });
}

// attach user callback to the process event emitter
// if no callback, it will still exit gracefully on Ctrl-C
process.on('cleanup',cleanup);

// do app specific cleaning before exiting
process.on('exit', function () {
    process.emit('cleanup');
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
    process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function() {
    process.exit(99);
});

module.exports.addFile = function(file){
    files.push(file);
};

