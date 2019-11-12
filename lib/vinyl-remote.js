/**
 * Allow remote paths in vinyl
 * Should be removed if https://github.com/gulpjs/vinyl/issues/127
 * is accepted and released.
 */

'use strict';

const url = require('url');
const File = require('vinyl');

Object.defineProperty(File.prototype, 'remotePath', {
    get() {
        return this.history[this.history.length - 1];
    },
    set(remotePath) {
        if (typeof remotePath !== 'string') {
            throw new TypeError('path should be a string.');
        }

        // Check url
        if (!/(^\/\/)|(:\/\/)/.test(remotePath)) {
            this.path = remotePath;
            return;
        }

        // eslint-disable-next-line node/no-deprecated-api
        const urlObj = url.parse(remotePath);
        remotePath = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

        // Record history only when path changed
        if (remotePath && remotePath !== this.remotePath) {
            this.history.push(remotePath);
        }
    }
});

module.exports = File;
