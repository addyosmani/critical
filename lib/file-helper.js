'use strict';
const os = require('os');
const fs = require('fs');
const url = require('url');
const path = require('path');
const _ = require('lodash');
const Bluebird = require('bluebird');
const request = require('request');
const debug = require('debug')('critical:file');
const mime = require('mime-types');
const slash = require('slash');
const oust = require('oust');
const chalk = require('chalk');
const tmp = require('tmp');
// Use patched vinyl to allow remote paths
const File = require('./vinyl-remote');
const gc = require('./gc');

Bluebird.promisifyAll(tmp);
Bluebird.promisifyAll(fs);
tmp.setGracefulCleanup();

/**
 * Get first array entry
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
    // Set dest path with fallback to html path
    const destPath = opts.destFolder || (opts.dest && path.dirname(opts.dest)) || path.dirname(html.path);
    const destPathResolved = path.resolve(destPath);
    const baseResolved = path.resolve(opts.base);

    /**
     * The resulting function should get passed an vinyl object with the css file
     */
    return function (stylesheet) {
        // Normalize relative paths
        const css = stylesheet.contents.toString().replace(/url\(['"]?([^'"\\)]+)['"]?\)/g, (match, assetPath) => {
            // Skip absolute paths, urls and data-uris
            if (assetPath.startsWith('data:') || /(?:^\/)|(?::\/\/)/.test(assetPath)) {
                return match;
            }

            // Create asset path relative to opts.base
            const stylesheetPath = path.dirname(stylesheet.path);
            const assetRelative = path.relative(baseResolved, path.resolve(path.join(stylesheetPath, assetPath)));

            // Compute path prefix default relative to html
            const pathPrefixDefault = path.relative(destPathResolved, baseResolved);

            const pathPrefix = (typeof opts.pathPrefix === 'undefined') ? pathPrefixDefault : opts.pathPrefix;

            return normalizePath(match.replace(assetPath, path.join(pathPrefix, assetRelative)));
        });

        stylesheet.contents = Buffer.from(css);
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
        const contentType = resp.headers['content-type'];
        return tmp.fileAsync(_.assign(opts, {postfix: '.' + mime.extension(contentType)}))
            .then(getFirst)
            .then(path => {
                gc.addFile(path);
                return fs.writeFileAsync(path, resp.body).then(() => {
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
    return new Bluebird((resolve, reject) => {
        // Handle protocol-relative urls
        uri = url.resolve('http://te.st', uri);
        request(uri, (err, resp) => {
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
            return new Bluebird(resolve => {
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
        const folder = path.relative(opts.base, path.dirname(htmlfile.path));
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
    const html = opts.html;

    if (typeof opts.src !== 'undefined') {
        return path.dirname(opts.src);
    }

    if (typeof opts.folder !== 'undefined') {
        const folder = path.isAbsolute(opts.folder) ? opts.folder : path.join(opts.base, opts.folder);
        opts.pathPrefix = path.relative(opts.folder, opts.base);
        return folder;
    }

    if (!opts.pathPrefix) {
        const links = oust(html, 'stylesheets');

        debug('generateSourcePath - links', links);
        // We can only determine a valid path by checking relative links
        const relative = _.chain(links).omitBy(link => {
            return link.startsWith('data:') || /(?:^\/)|(?::\/\/)/.test(link);
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

        const dots = _.map(relative, link => {
            const match = /^(\.\.\/)+/.exec(link);
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
        return new Bluebird(resolve => {
            resolve(opts.src);
        });
    }

    const file = new File({
        base: opts.base
    });

    if (opts.src && isExternal(opts.src)) {
        file.remotePath = opts.src;
    } else if (opts.src) {
        file.path = opts.src;
    }

    if (opts.html) {
        const folder = generateSourcePath(opts);
        debug('hacky source path folder', folder);

        // Html passed in directly -> create tmp file
        return tmp.fileAsync({dir: opts.base, postfix: '.html'})
            .then(getFirst)
            .then(filepath => {
                file.path = filepath;
                file.path = path.join(folder, path.basename(filepath));
                file.base = folder;
                file.contents = Buffer.from(opts.html);
                gc.addFile(filepath);
                return fs.writeFileAsync(filepath, file.contents).then(() => {
                    return file;
                });
            });
    }

    // Use src file provided, fetch content and return vinyl
    return assertLocal(opts)(opts.src)
        .then(data => {
            // Src can either be absolute or relative to opts.base
            if (opts.src !== path.resolve(data) && !isExternal(opts.src)) {
                file.path = path.join(opts.base, opts.src);
            } else {
                file.path = path.relative(process.cwd(), data);
            }

            return fs.readFileAsync(file.path).then(contents => {
                file.contents = contents;
                return file;
            });
        });
}

exports.normalizePath = normalizePath;
exports.isExternal = isExternal;
exports.isVinyl = isVinyl;
exports.replaceAssetPaths = replaceAssetPaths;
exports.getPenthouseUrl = getPenthouseUrl;
exports.guessBasePath = guessBasePath;
exports.resourcePath = resourcePath;
exports.assertLocal = assertLocal;
exports.getVinylPromise = getVinylPromise;
