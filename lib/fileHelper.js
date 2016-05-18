'use strict';
var fs = require('fs');
var url = require('url');
var path = require('path');
var _ = require('lodash');
/* jshint -W079 */
var Promise = require('bluebird');
var request = require('request');
var mime = require('mime-types');
var slash = require('slash');
var tmp = require('tmp');
var gc = require('./gc');

Promise.promisifyAll(tmp);
Promise.promisifyAll(fs);
tmp.setGracefulCleanup();

/**
 * get first array entry
 * @param {array} data
 * @returns {*}
 */
function getFirst(data) {
    return _.isArray(data) ? _.first(data) : data;
}

/**
 * Fixup slashes in file paths for windows
 */
function normalizePath(str) {
    return process.platform === 'win32' ? slash(str) : str;
}

/**
 * Get html path for penthouse
 * Needs to be an absolute file:// url for local files to work on windows
 * @param opts
 * @returns {*}
 */
function getPenthouseUrl(opts, port) {
    if (opts.src && isExternal(opts.src)) {
        return opts.src;
    }

    return 'http://127.0.0.1:' + port + '/' + normalizePath(path.relative(path.resolve(opts.base), opts.url));
}

/**
 * Check wether a resource is external or not
 * @param href
 * @returns {boolean}
 */
function isExternal(href) {
    return /(^\/\/)|(:\/\/)/.test(href);
}

/**
 * Generate temp file from request response object
 * @param opts
 * @returns {Function}
 */
function temp(opts) {
    return function (resp) {
        var contentType = resp.headers['content-type'];
        return tmp.fileAsync(_.assign(opts, {postfix: '.' + mime.extension(contentType)}))
            .then(getFirst)
            .then(function (path) {
                gc.addFile(path);
                return fs.writeFileAsync(path, resp.body).then(function () {
                    return path;
                });
            });
    };
}

/**
 * Get external resource
 * @param {string} uri
 * @returns {Promise}
 */
function requestAsync(uri) {
    return new Promise(function (resolve, reject) {
        // handle protocol-relative urls
        uri = url.resolve('http://te.st', uri);
        request(uri, function (err, resp) {
            if (err) {
                return reject(err);
            }
            if (resp.statusCode === 403 || resp.statusCode === 404) {
                console.log('Ignoring', uri, '(' + resp.statusCode + ')');
                resp.body = '';
                return resolve(resp);
            }

            if (resp.statusCode !== 200) {
                return reject(new Error('Wrong status code ' + resp.statusCode + ' for ' + uri));
            }

            resolve(resp);
        });
    });
}

/**
 * Get default base path based on options
 * @param opts
 * @returns {string}
 */
function guessBasePath(opts) {
    if (opts.src && !isExternal(opts.src)) {
        return path.dirname(opts.src);
    }

    return process.cwd();
}

/**
 * Returns a promise to a local file
 * @param opts
 * @returns {Promise}
 */
function assertLocal(opts) {
    return function (filePath) {
        if (!isExternal(filePath)) {
            return new Promise(function (resolve) {
                resolve(filePath);
            });
        }

        return requestAsync(filePath)
            .then(temp({
                dir: opts.base
            }));
    };
}

/**
 * Resolve path to file
 * @param opts
 * @returns {Function}
 */
function resourcePath(opts) {
    return function (file) {
        if (isExternal(file)) {
            return file;
        }
        if (!isExternal(opts.src)) {
            return path.join(opts.base, file.split('?')[0]);
        }
        return url.resolve(opts.src, file);
    };
}

/**
 * Get content based on options
 * could either be a html string or a local file
 * @param opts
 * @returns {{promise: *, tmpfiles: Array}}
 */
function getContentPromise(opts) {
    if (!(opts.src || opts.html) || !opts.base) {
        return Promise.reject(new Error('A valid source and base path are required.'));
    }

    // html passed in directly -> create tmp file and set opts.url
    if (opts.html) {
        return tmp.fileAsync({dir: opts.base, postfix: '.html'})
            .then(getFirst)
            .then(function (path) {
                opts.url = path;
                return fs.writeFileAsync(opts.url, opts.html).then(function () {
                    return opts.html;
                });
            });
    }

    // use src file provided
    return assertLocal(opts)(opts.src)
        .then(function (data) {
            // src can either be absolute or relative to opts.base
            if (opts.src !== path.resolve(data) && !isExternal(opts.src)) {
                opts.url = path.join(opts.base, opts.src);
            } else {
                opts.url = path.relative(process.cwd(), data);
            }
            return fs.readFileAsync(opts.url);
        });
}

exports.isExternal = isExternal;
exports.normalizePath = normalizePath;
exports.getPenthouseUrl = getPenthouseUrl;
exports.guessBasePath = guessBasePath;
exports.resourcePath = resourcePath;
exports.assertLocal = assertLocal;
exports.getContentPromise = getContentPromise;
