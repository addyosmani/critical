'use strict';
var _ = require('lodash');
/* jshint -W079 */
var Promise = require('bluebird');
var request = require('request');
var mime = require('mime-types');
var File = require('vinyl');
var slash = require('slash');
var path = require('path');
var url = require('url');
var tmp = require('tmp');
var fs = require('fs');
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
function getPenthouseUrl(opts, file, port) {
    if (opts.src && isExternal(opts.src)) {
        return opts.src;
    } else {
        return 'http://127.0.0.1:' + port + '/' + normalizePath(path.relative(path.resolve(file.base), file.path));
    }
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
            if (resp.statusCode !== 200) {
                return reject('Wrong status code ' + resp.statusCode + ' for ' + url);
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
    } else {
        return process.cwd();
    }
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
 * @returns {promise} resolves to vinyl object
 */
function getVinylPromise(opts) {
    if (!(opts.src || opts.html) || !opts.base) {
        return Promise.reject(new Error('A valid source and base path are required.'));
    }

    var file;

    if (File.isVinyl(opts.src)) {
        return new Promise(function (resolve) {
            resolve(opts.src);
        });

    } else if (opts.html) {
        // html passed in directly -> create tmp file
        return tmp.fileAsync({dir: opts.base, postfix: '.html'})
            .then(getFirst)
            .then(function (filepath) {
                file = new File({
                    cwd: opts.base,
                    base: path.dirname(filepath),
                    path: filepath,
                    contents: new Buffer(opts.html)
                });

                return fs.writeFileAsync(file.path, file.contents).then(function () {
                    return file;
                });
            });
        // use src file provided
    } else {

        return assertLocal(opts)(opts.src)
            .then(function (data) {
                file = new File({
                    cwd: opts.base
                });

                // src can either be absolute or relative to opts.base
                if (opts.src !== path.resolve(data) && !isExternal(opts.src)) {
                    file.path = path.join(opts.base, opts.src);
                } else {
                    file.path = path.relative(process.cwd(), data);
                }

                file.base = path.dirname(file.path);
                return fs.readFileAsync(file.path).then(function (contents) {
                    file.contents = contents;
                    return file;
                });
            });
    }
}

exports.isExternal = isExternal;
exports.normalizePath = normalizePath;
exports.getPenthouseUrl = getPenthouseUrl;
exports.guessBasePath = guessBasePath;
exports.resourcePath = resourcePath;
exports.assertLocal = assertLocal;
exports.getVinylPromise = getVinylPromise;
