/**
 * Allow remote paths in vinyl
 * Should be removed if https://github.com/gulpjs/vinyl/issues/127
 * is accepted and released.
 */

'use strict';
var url = require('url');
var File = require('vinyl');

Object.defineProperty(File.prototype, 'remotePath', {
    get: function () {
        return this.history[this.history.length - 1];
    },
    set: function (remotePath) {
        if (typeof remotePath !== 'string') {
            throw new Error('path should be a string.');
        }

        // check url
        if (!/(^\/\/)|(:\/\/)/.test(remotePath)) {
            this.path = remotePath;
            return;
        }

        var urlObj = url.parse(remotePath);
        remotePath = urlObj.protocol + '//' + urlObj.host + urlObj.pathname;

        // Record history only when path changed
        if (remotePath && remotePath !== this.remotePath) {
            this.history.push(remotePath);
        }
    }
});

module.exports = File;
