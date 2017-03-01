'use strict';
var os = require('os');
var fs = require('fs');
var url = require('url');
var path = require('path');
var _ = require('lodash');
var Bluebird = require('bluebird');
var request = require('request');
var debug = require('debug')('critical:file');
var mime = require('mime-types');
var slash = require('slash');
var oust = require('oust');
var chalk = require('chalk');
var tmp = require('tmp');
// Use patched vinyl to allow remote paths
var File = require('./vinyl-remote');
var gc = require('./gc');

Bluebird.promisifyAll(tmp);
Bluebird.promisifyAll(fs);
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
 * @param {string} str path
 * @returns {string}
 */
function normalizePath(str) {
    return process.platform === 'win32' ? slash(str) : str;
}

/**
 * Helper function to rewrite the file paths relative to the stylesheet
 * to be relative to the html file
 * @param {File} html
 * @param opts
 * @returns {function}
 */
function replaceAssetPaths(html, opts) {
    // set dest path with fallback to html path
    var destPath = opts.destFolder || (opts.dest && path.dirname(opts.dest)) || path.dirname(html.path);
    var destPathResolved = path.resolve(destPath);
    var baseResolved = path.resolve(opts.base);

    /**
     * the resulting function should get passed an vinyl object with the css file
     */
    return function (stylesheet) {
        // normalize relative paths
        var css = stylesheet.contents.toString().replace(/url\(['"]?([^'"\\)]+)['"]?\)/g, function (match, assetPath) {
            // skip absolute paths, urls and data-uris
            if (/^data:/.test(assetPath) || /(?:^\/)|(?::\/\/)/.test(assetPath)) {
                return match;
            }

            // create asset path relative to opts.base
            var stylesheetPath = path.dirname(stylesheet.path);
            var assetRelative = path.relative(baseResolved, path.resolve(path.join(stylesheetPath, assetPath)));

            // compute path prefix default relative to html
            var pathPrefixDefault = path.relative(destPathResolved, baseResolved);

            var pathPrefix = (typeof opts.pathPrefix === 'undefined') ? pathPrefixDefault : opts.pathPrefix;

            return normalizePath(match.replace(assetPath, path.join(pathPrefix, assetRelative)));
        });

        stylesheet.contents = new Buffer(css);
        return stylesheet;
    };
}

/**
 * Get html path for penthouse
 * Needs to be an absolute file:// url for local files to work on windows
 * @param {object} opts Options passed to critical
 * @param {File} file Vinyl file object of html file
 * @param {string} port Server port
 * @returns {string}
 */
function getPenthouseUrl(opts, file, port) {
    if (opts.src && isExternal(opts.src)) {
        return opts.src;
    }

    return 'http://127.0.0.1:' + port + '/' + normalizePath(path.relative(path.resolve(file.base), file.path));
}

/**
 * Check wether a resource is external or not
 * @param {string} href
 * @returns {boolean}
 */
function isExternal(href) {
    return /(^\/\/)|(:\/\/)/.test(href);
}

/**
 * Generate temp file from request response object
 * @param {object} opts Options passed to critical
 * @returns {function}
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
    return new Bluebird(function (resolve, reject) {
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
 * @param {object} opts Options passed to critical
 * @returns {string}
 */
function guessBasePath(opts) {
    if (opts.src && !isExternal(opts.src) && !isVinyl(opts.src)) {
        return path.dirname(opts.src);
    } else if (opts.src && isVinyl(opts.src)) {
        return opts.src.dirname;
    }

    return process.cwd();
}

/**
 * Wrapper for File.isVinyl to detect vinyl objects generated by gulp (vinyl < v0.5.6)
 * @param {*} file
 * @returns {string}
 */
function isVinyl(file) {
    return File.isVinyl(file) ||
        file instanceof File ||
        (file && /function File\(/.test(file.constructor.toString()) && file.contents && file.path);
}

/**
 * Returns a promise to a local file
 * @param {object} opts Options passed to critical
 * @returns {function}
 */
function assertLocal(opts) {
    return function (filePath) {
        if (!isExternal(filePath)) {
            return new Bluebird(function (resolve) {
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
 * @param {File} htmlfile Vinyl file object of html file
 * @param {object} opts Options passed to critical
 * @returns {function}
 */
function resourcePath(htmlfile, opts) {
    return function (filepath) {
        if (isExternal(filepath)) {
            debug('resourcePath - remote', filepath);
            return filepath;
        }

        if (isExternal(htmlfile.history[0])) {
            debug('resourcePath - remote', htmlfile.history[0]);
            return url.resolve(htmlfile.history[0], filepath);
        }

        if (/(?:^\/)/.test(filepath)) {
            return path.join(opts.base, filepath.split('?')[0]);
        }
        var folder = path.relative(opts.base, path.dirname(htmlfile.path));
        if (folder) {
            debug('resourcePath - folder', folder);
        }
        return path.join(path.dirname(htmlfile.path), filepath.split('?')[0]);
    };
}

/**
 * Compute a source path which fits to the directory structure
 * so that relative links could be resolved
 * @param {object} opts Options passed to critical
 * @returns {string}
 */
function generateSourcePath(opts) {
    var html = opts.html;

    if (typeof opts.src !== 'undefined') {
        return path.dirname(opts.src);
    }

    if (typeof opts.folder !== 'undefined') {
        var folder = path.isAbsolute(opts.folder) ? opts.folder : path.join(opts.base, opts.folder);
        opts.pathPrefix = path.relative(opts.folder, opts.base);
        return folder;
    }

    if (!opts.pathPrefix) {
        var links = oust(html, 'stylesheets');

        debug('generateSourcePath - links', links);
        // we can only determine a valid path by checking relative links
        var relative = _.chain(links).omitBy(function (link) {
            return /^data:/.test(link) || /(?:^\/)|(?::\/\/)/.test(link);
        }).toArray().value();

        debug('generateSourcePath - relative', relative);

        if (relative.length === 0) {
            process.stderr.write([
                chalk.red('Warning:'),
                'Missing html source path. Consider \'folder\' option.',
                'https://goo.gl/PwvFVb',
                os.EOL
            ].join(' '));

            opts.pathPrefix = '/';
            return opts.base;
        }

        var dots = _.map(relative, function (link) {
            var match = /^(\.\.\/)+/.exec(link);
            return _.first(match);
        });

        opts.pathPrefix = _.chain(dots).sortBy('length').last().value() || '';
        debug('generateSourcePath', opts.pathPrefix.replace(/\.\./g, '~'));
    }

    return path.join(opts.base, opts.pathPrefix.replace(/\.\./g, '~'));
}

/**
 * Get vinyl object based on options
 * could either be a html string or a local file.
 * If opts.src already is a vinyl object it gets returnd without modifications
 * @param {object} opts Options passed to critical
 * @returns {promise} resolves to vinyl object
 */
function getVinylPromise(opts) {
    if (!(opts.src || opts.html) || !opts.base) {
        return Bluebird.reject(new Error('A valid source and base path are required.'));
    }

    if (isVinyl(opts.src)) {
        return new Bluebird(function (resolve) {
            resolve(opts.src);
        });
    }

    var file = new File({
        base: opts.base
    });

    if (opts.src && isExternal(opts.src)) {
        file.remotePath = opts.src;
    } else if (opts.src) {
        file.path = opts.src;
    }

    if (opts.html) {
        var folder = generateSourcePath(opts);
        debug('hacky source path folder', folder);

        // html passed in directly -> create tmp file
        return tmp.fileAsync({dir: opts.base, postfix: '.html'})
            .then(getFirst)
            .then(function (filepath) {
                file.path = filepath;
                file.path = path.join(folder, path.basename(filepath));
                file.base = folder;
                file.contents = new Buffer(opts.html);
                gc.addFile(filepath);
                return fs.writeFileAsync(filepath, file.contents).then(function () {
                    return file;
                });
            });
    }

    // use src file provided, fetch content and return vinyl
    return assertLocal(opts)(opts.src)
        .then(function (data) {
            // src can either be absolute or relative to opts.base
            if (opts.src !== path.resolve(data) && !isExternal(opts.src)) {
                file.path = path.join(opts.base, opts.src);
            } else {
                file.path = path.relative(process.cwd(), data);
            }

            return fs.readFileAsync(file.path).then(function (contents) {
                file.contents = contents;
                return file;
            });
        });
}

exports.isExternal = isExternal;
exports.isVinyl = isVinyl;
exports.replaceAssetPaths = replaceAssetPaths;
exports.getPenthouseUrl = getPenthouseUrl;
exports.guessBasePath = guessBasePath;
exports.resourcePath = resourcePath;
exports.assertLocal = assertLocal;
exports.getVinylPromise = getVinylPromise;
