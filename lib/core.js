'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');
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
var getPort = require('get-port');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var debug = require('debug')('critical:core');

var FileHelper = require('./fileHelper');
var gc = require('./gc');

// promisify fs and penthouse
Promise.promisifyAll(fs);
var penthouseAsync = Promise.promisify(penthouse);

/**
 * returns a string of combined and deduped css rules.
 * @param cssArray
 * @returns {String}
 */
function combineCss(cssArray) {
    if (cssArray.length === 1) {
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
 * @returns {function}
 */
function appendStylesheets(opts) {
    return function (file) {
        // consider opts.css and map to array if it's a string
        if (opts.css) {
            file.stylesheets = typeof opts.css === 'string' ? [opts.css] : opts.css;
            return file;
        }

        // Oust extracts a list of your stylesheets
        var stylesheets = oust(file.contents.toString(), 'stylesheets');
        debug('Stylesheets: ' + stylesheets);
        stylesheets = stylesheets.map(FileHelper.resourcePath(file, opts));
        return Promise.map(stylesheets, FileHelper.assertLocal(opts)).then(function (stylesheets) {
            file.stylesheets = stylesheets;
            return file;
        });
    };
}

/**
 * Inline images using postcss-image-inliner
 * @param opts
 * @returns {function}
 */
function inlineImages(opts) {
    return function _inlineImages(vinyl) {
        if (opts.inlineImages) {
            var inlineOptions = {
                assetPaths: _.uniq((opts.assetPaths || []).concat([path.dirname(vinyl.path), opts.base])),
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

/**
 * Helper function to rebase the file paths relative to the stylesheet
 * to be relative to the html file
 * @param file
 * @param opts
 * @returns {function}
 */
function normalizePaths(file, opts) {
    return function _normalizePaths(vinyl) {
        // normalize relative paths
        var css = vinyl.contents.toString().replace(/url\(['"]?([^'"\)]+)['"]?\)/g, function (match, filePath) {
            // do nothing for absolute paths, urls and data-uris
            if (/^data:/.test(filePath) || /(?:^\/)|(?::\/\/)/.test(filePath)) {
                return match;
            }

            // create asset path relative to opts.base
            var cssDir = path.dirname(vinyl.path);
            var assetRelative = path.relative(path.resolve(opts.base), path.resolve(path.join(cssDir, filePath)));

            // compute path prefix default relative to html
            var htmlDir = path.resolve(path.dirname(file.path));
            var pathPrefixDefault = path.relative(htmlDir, opts.base);

            var pathPrefix = (typeof opts.pathPrefix === 'undefined') ? pathPrefixDefault : opts.pathPrefix;
            return FileHelper.normalizePath(match.replace(filePath, path.join(pathPrefix, assetRelative)));
        });

        vinyl.contents = new Buffer(css);
        return vinyl;
    };
}

/**
 * Helper function create vinyl objects
 * @param opts
 * @returns {function}
 */
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
 * @returns {function}
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
 * @param {object} opts Options passed to critical
 * @returns {function}
 */
function computeCritical(dimensions, opts) {
    return function _computeCritical(file) {
        return startServer(opts).then(function (server) {
            debug('Processing: ' + file.path + ' [' + dimensions.width + 'x' + dimensions.height + ']');
            return penthouseAsync({
                url: FileHelper.getPenthouseUrl(opts, file, server.port),
                css: file.cssPath,
                forceInclude: opts.include || [],
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
