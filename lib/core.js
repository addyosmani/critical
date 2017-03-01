'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var url = require('url');
var http = require('http');
var _ = require('lodash');
var penthouse = require('penthouse');
var CleanCSS = require('clean-css');
var filterCss = require('filter-css');
var oust = require('oust');
var postcss = require('postcss');
var imageInliner = require('postcss-image-inliner');
var Bluebird = require('bluebird');
var tempfile = require('tempfile');
var getPort = require('get-port');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var debug = require('debug')('critical:core');

var file = require('./file-helper');
var gc = require('./gc');

// promisify fs and penthouse
Bluebird.promisifyAll(fs);
var penthouseAsync = Bluebird.promisify(penthouse);

/**
 * returns a string of combined and deduped css rules.
 * @param cssArray
 * @returns {String}
 */
function combineCss(cssArray) {
    if (cssArray.length === 1) {
        return cssArray[0].toString();
    }

    return new CleanCSS({
        level: {
            1: {
                all: true
            },
            2: {
                all: false,
                removeDuplicateFontRules: true,
                removeDuplicateMediaBlocks: true,
                removeDuplicateRules: true,
                mergeMedia: true
            }
        }
    }).minify(
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
    return function (htmlfile) {
        // consider opts.css and map to array if it's a string
        if (opts.css) {
            htmlfile.stylesheets = typeof opts.css === 'string' ? [opts.css] : opts.css;
            return htmlfile;
        }

        // Oust extracts a list of your stylesheets
        var stylesheets = oust(htmlfile.contents.toString(), 'stylesheets');
        debug('appendStylesheets', stylesheets);
        stylesheets = stylesheets.map(file.resourcePath(htmlfile, opts));
        return Bluebird.map(stylesheets, file.assertLocal(opts)).then(function (stylesheets) {
            htmlfile.stylesheets = stylesheets;
            return htmlfile;
        });
    };
}

/**
 * Inline images using postcss-image-inliner
 * @param opts
 * @returns {function}
 */
function inlineImages(opts) {
    return function (vinyl) {
        if (opts.inlineImages) {
            var assetPaths = opts.assetPaths || [];

            // Add some suitable fallbacks for convinience if nothing is set.
            // Otherwise don't add them to keep the user in control
            if (assetPaths.length === 0) {
                assetPaths.push(path.dirname(vinyl.path));
                // Add domain as asset source for external domains
                if (file.isExternal(opts.src)) {
                    var urlObj = url.parse(opts.src);
                    var domain = urlObj.protocol + '//' + urlObj.host;
                    assetPaths.push(domain, domain + path.dirname(urlObj.pathname));
                }

                if (opts.base) {
                    assetPaths.push(opts.base);
                }
            }

            var inlineOptions = {
                assetPaths: _.uniq(assetPaths),
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
 * Helper function create vinyl objects
 * @param opts
 * @returns {function}
 */
function vinylize(opts) {
    return function (filepath) {
        debug('vinylize', path.resolve(filepath));
        return file.getVinylPromise({
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
    return function (htmlfile) {
        debug('processStylesheets', htmlfile.stylesheets);
        return Bluebird.map(htmlfile.stylesheets, vinylize(opts))
            .map(inlineImages(opts))
            .map(file.replaceAssetPaths(htmlfile, opts))
            .reduce(function (total, stylesheet) {
                return total + os.EOL + stylesheet.contents.toString('utf8');
            }, '')
            .then(function (css) {
                htmlfile.cssPath = tempfile('.css');
                // add file to garbage collector so it get's removed on exit
                gc.addFile(htmlfile.cssPath);

                return fs.writeFileAsync(htmlfile.cssPath, css).then(function () {
                    return htmlfile;
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
    return function (htmlfile) {
        return startServer(opts).then(function (server) {
            debug('Processing: ' + htmlfile.path + ' [' + dimensions.width + 'x' + dimensions.height + ']');
            return penthouseAsync({
                url: file.getPenthouseUrl(opts, htmlfile, server.port),
                css: htmlfile.cssPath,
                forceInclude: opts.include || [],
                timeout: opts.timeout,
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
        return Bluebird.reject(new Error('A valid source is required.'));
    }

    if (!opts.dimensions) {
        opts.dimensions = [{
            height: opts.height || 900,
            width: opts.width || 1300
        }];
    }

    debug('Start with the following options');
    debug(opts);

    return Bluebird.map(opts.dimensions, function (dimensions) {
        // use content to fetch used css files
        return file.getVinylPromise(opts)
            .then(appendStylesheets(opts))
            .then(processStylesheets(opts))
            .then(computeCritical(dimensions, opts));
    }).then(function (criticalCSS) {
        criticalCSS = combineCss(criticalCSS);

        if (opts.ignore) {
            debug('generate', 'Applying filter', opts.ignore);
            criticalCSS = filterCss(criticalCSS, opts.ignore, opts.ignoreOptions || {});
        }

        if (opts.minify === true) {
            debug('generate', 'Minify css');
            criticalCSS = new CleanCSS().minify(criticalCSS).styles;
        }

        debug('generate', 'Done');
        return criticalCSS;
    });
}

exports.generate = generate;
