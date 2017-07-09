'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const http = require('http');
const invokeMap = require('lodash/invokeMap');
const assign = require('lodash/assign');
const uniq = require('lodash/uniq');
const flatten = require('lodash/flatten');
const penthouse = require('penthouse');
const CleanCSS = require('clean-css');
const filterCss = require('filter-css');
const oust = require('oust');
const postcss = require('postcss');
const imageInliner = require('postcss-image-inliner');
const Bluebird = require('bluebird');
const tempfile = require('tempfile');
const getPort = require('get-port');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const debug = require('debug')('critical:core');

const file = require('./file-helper');
const gc = require('./gc');

// Promisify fs and penthouse
Bluebird.promisifyAll(fs);
const penthouseAsync = Bluebird.promisify(penthouse);

/**
 * Returns a string of combined and deduped css rules.
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
                removeEmpty: true,
                mergeMedia: true
            }
        }
    }).minify(
        invokeMap(cssArray, 'toString').join(' ')
    ).styles;
}

/**
 * Start server for penthouse
 *
 * @param opts
 * @returns {Promise}
 */
function startServer(opts) {
    const cb = serveStatic(opts.base);

    return getPort().then(port => {
        const server = http.createServer((req, res) => {
            const done = finalhandler(req, res);
            cb(req, res, done);
        }).listen(port);

        return {
            instance: server,
            port
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
        // Consider opts.css and map to array if it isn't one
        if (opts.css) {
            htmlfile.stylesheets = Array.isArray(opts.css) ? opts.css : [opts.css];
            return htmlfile;
        }

        // Oust extracts a list of your stylesheets
        let stylesheets = flatten([
            oust.raw(htmlfile.contents.toString(), 'stylesheets'),
            oust.raw(htmlfile.contents.toString(), 'preload')
        ]).filter(link => link.$el.attr('media') !== 'print').map(link => link.value);

        stylesheets = uniq(stylesheets).map(file.resourcePath(htmlfile, opts));
        debug('appendStylesheets', stylesheets);

        return Bluebird.map(stylesheets, file.assertLocal(opts)).then(stylesheets => {
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
            const assetPaths = opts.assetPaths || [];

            // Add some suitable fallbacks for convinience if nothing is set.
            // Otherwise don't add them to keep the user in control
            if (assetPaths.length === 0) {
                assetPaths.push(path.dirname(vinyl.path));
                // Add domain as asset source for external domains
                if (file.isExternal(opts.src)) {
                    const urlObj = url.parse(opts.src);
                    const domain = urlObj.protocol + '//' + urlObj.host;
                    assetPaths.push(domain, domain + path.dirname(urlObj.pathname));
                }

                if (opts.base) {
                    assetPaths.push(opts.base);
                }
            }

            const inlineOptions = {
                assetPaths: uniq(assetPaths),
                maxFileSize: opts.maxImageFileSize || 10240
            };
            debug('inlineImages', inlineOptions);
            return postcss([imageInliner(inlineOptions)])
                .process(vinyl.contents.toString('utf8'))
                .then(contents => {
                    vinyl.contents = Buffer.from(contents.css);
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
        if (filepath._isVinyl) {
            return filepath;
        }
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
            .reduce((total, stylesheet) => {
                return total + os.EOL + stylesheet.contents.toString('utf8');
            }, '')
            .then(css => {
                htmlfile.cssPath = tempfile('.css');
                // Add file to garbage collector so it get's removed on exit
                gc.addFile(htmlfile.cssPath);

                return fs.writeFileAsync(htmlfile.cssPath, css).then(() => {
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
        return startServer(opts).then(server => {
            debug('Processing: ' + htmlfile.path + ' [' + dimensions.width + 'x' + dimensions.height + ']');
            return penthouseAsync(assign({}, opts.penthouse, {
                url: file.getPenthouseUrl(opts, htmlfile, server.port),
                css: htmlfile.cssPath,
                width: dimensions.width,
                height: dimensions.height
            })).finally(() => {
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

    return Bluebird.map(opts.dimensions, dimensions => {
        // Use content to fetch used css files
        return file.getVinylPromise(opts)
            .then(appendStylesheets(opts))
            .then(processStylesheets(opts))
            .then(computeCritical(dimensions, opts));
    }).then(criticalCSS => {
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

exports.appendStylesheets = appendStylesheets;
exports.generate = generate;
