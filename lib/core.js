'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var _ = require('lodash');
var penthouse = require('penthouse');
var CleanCSS = require('clean-css');
var filterCss = require('filter-css');
var oust = require('oust');
var postcss = require('postcss');
var imageInliner = require('postcss-image-inliner');

/* jshint -W079 */
var Promise = require('bluebird');
var tempfile = require('tempfile');
var FileHelper = require('./fileHelper');
var gc = require('./gc');

var getPort = require('get-port');
var finalhandler = require('finalhandler');
var http = require('http');
var serveStatic = require('serve-static');

var debug = require('debug')('critical:core');

// promisify fs and penthouse
Promise.promisifyAll(fs);
var penthouseAsync = Promise.promisify(penthouse);

/**
 * returns a string of combined and deduped css rules.
 * @param cssArray
 * @returns {String}
 */
function combineCss(cssArray) {
    if (cssArray.length == 1) {
        return cssArray[0].toString();
    }

    return new CleanCSS({mediaMerging: true}).minify(
        _.invokeMap(cssArray, 'toString').join(' ')
    ).styles;
}

/**
 * Start server for penthouse
 *
 * @param opts
 * @returns {Promise}
 */
function startServer(opts) {
    var cb = serveStatic(opts.base);

    return getPort().then(function (port) {
        var server = http.createServer(function (req, res) {
            var done = finalhandler(req, res);
            cb(req, res, done);
        }).listen(port);

        return {
            instance: server,
            port: port
        };
    });
}

/**
 * Append stylesheets to result
 * @param opts
 * @returns {Function}
 */
function appendStylesheets(opts) {
    return function (file) {
        // consider opts.css and map to array if it's a string
        if (opts.css) {
            file.stylesheets = typeof opts.css === 'string' ? [opts.css] : opts.css;
            return file;
        }

        // Oust extracts a list of your stylesheets
        var stylesheets = oust(file.contents.toString(), 'stylesheets').map(FileHelper.resourcePath(opts));
        debug('Stylesheets: ' + stylesheets);
        return Promise.map(stylesheets, FileHelper.assertLocal(opts)).then(function (stylesheets) {
            file.stylesheets = stylesheets;
            return file;
        });
    };
}

function inlineImages(opts) {
    return function _inlineImages(vinyl) {

        if (opts.inlineImages) {
            var inlineOptions = {
                assetPaths: _.uniq((opts.assetPaths || []).concat([vinyl.base, opts.base])),
                maxFileSize: opts.maxImageFileSize || 10240
            };
            debug('inlineImages', inlineOptions);
            return postcss([imageInliner(inlineOptions)])
                .process(vinyl.contents.toString('utf8'))
                .then(function (contents) {
                    vinyl.contents = new Buffer(contents.css);
                    return vinyl;
                });
        }

        return vinyl;
    };
}

function normalizePaths(file, opts) {
    return function _normalizePaths(vinyl) {

        // normalize relative paths
        var css = vinyl.contents.toString().replace(/url\(['"]?([^'"\)]+)['"]?\)/g, function (match, filePath) {
            // do nothing for absolute paths, urls and data-uris
            if (/^data\:/.test(filePath) || /(?:^\/)|(?:\:\/\/)/.test(filePath)) {
                return match;
            }

            // create path relative to opts.base
            var relativeToBase = path.relative(path.resolve(file.base), path.resolve(path.join(vinyl.base, filePath)));
            var pathPrefix = (typeof opts.pathPrefix === "undefined") ? "/" : opts.pathPrefix;
            var result = FileHelper.normalizePath(match.replace(filePath, path.join(pathPrefix, relativeToBase)));
            debug('normalizePaths', filePath, ' => ', result);
            return result;
        });

        vinyl.contents = new Buffer(css);
        return vinyl;
    };
}

function vinylize(opts) {
    return function _vinylize(filepath) {
        debug('vinylize', path.resolve(filepath));
        return FileHelper.getVinylPromise({
            src: path.resolve(filepath),
            base: opts.base
        });
    };
}

/**
 * Read css source, inline images and normalize relative paths
 * @param opts
 * @returns {Function}
 */
function processStylesheets(opts) {
    return function (file) {
        debug('processStylesheets', file.stylesheets);
        return Promise.map(file.stylesheets, vinylize(opts))
            .map(inlineImages(opts))
            .map(normalizePaths(file, opts))
            .reduce(function (total, stylesheet) {
                return total + os.EOL + stylesheet.contents.toString('utf8');
            }, '')
            .then(function (css) {
                file.cssPath = tempfile('.css');
                // add file to garbage collector so it get's removed on exit
                gc.addFile(file.cssPath);

                return fs.writeFileAsync(file.cssPath, css).then(function () {
                    return file;
                });
            });
    };
}

/**
 * Fire up a server as pentouse doesn't like filesystem paths on windows
 * and let pentouse compute the critical css for us
 * @param dimensions
 * @param opts
 * @returns {function}
 */
function computeCritical(dimensions, opts) {
    return function _computeCritical(file) {
        return startServer(opts).then(function (server) {
            debug('Processing: ' + file.path + ' [' + dimensions.width + 'x' + dimensions.height + ']');
            return penthouseAsync({
                url: FileHelper.getPenthouseUrl(opts, file, server.port),
                css: file.cssPath,
                maxEmbeddedBase64Length: opts.maxImageFileSize || 10240,
                width: dimensions.width,
                height: dimensions.height
            }).finally(function () {
                server.instance.close();
            });
        });
    };
}

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise}
 */
function generate(opts) {
    opts = opts || {};

    if (!opts.src && !opts.html) {
        return Promise.reject(new Error('A valid source is required.'));
    }

    if (!opts.dimensions) {
        opts.dimensions = [{
            height: opts.height || 900,
            width: opts.width || 1300
        }];
    }

    debug(opts);

    return Promise.map(opts.dimensions, function (dimensions) {
        // use content to fetch used css files
        return FileHelper.getVinylPromise(opts)
            .then(appendStylesheets(opts))
            .then(processStylesheets(opts))
            .then(computeCritical(dimensions, opts));
    }).then(function (criticalCSS) {
        criticalCSS = combineCss(criticalCSS);

        if (opts.ignore) {
            debug('Applying filter', opts.ignore);
            criticalCSS = filterCss(criticalCSS, opts.ignore, opts.ignoreOptions || {});
        }

        if (opts.minify === true) {
            debug('Minify css');
            criticalCSS = new CleanCSS().minify(criticalCSS).styles;
        }

        debug('Done');
        return criticalCSS;

    });
}

exports.generate = generate;
