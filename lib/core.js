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

var file = require('./fileHelper');
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
        return file.getContentPromise(opts).then(function (html) {
            // consider opts.css and map to array if it's a string
            if (opts.css) {
                return typeof opts.css === 'string' ? [opts.css] : opts.css;
            }

            // Oust extracts a list of your stylesheets
            var stylesheets = oust(html.toString(), 'stylesheets').map(file.resourcePath(opts));
            debug('Stylesheets: ' + stylesheets);
            return Promise.map(stylesheets, file.assertLocal(opts));
            // read files
        }).map(function (fileName) {
            return fs.readFileAsync(fileName, 'utf8').then(function (content) {
                // get path to css file
                var dir = path.dirname(fileName);

                if (opts.inlineImages) {
                    return postcss([imageInliner({
                        assetPaths: _.uniq((opts.assetPaths || []).concat([dir, opts.base])),
                        maxFileSize: opts.maxImageFileSize || 10240
                    })]).process(content).then(function (result) {
                        return {
                            dir: path.dirname(fileName),
                            content: result
                        };
                    });
                }

                return {
                    dir: path.dirname(fileName),
                    content: content
                };
            }).then(function (data) {
                var content = data.content;
                var dir = data.dir;

                // normalize relative paths
                return content.toString().replace(/url\(['"]?([^'"\)]+)['"]?\)/g, function (match, filePath) {
                    // do nothing for absolute paths, urls and data-uris
                    if (/^data:/.test(filePath) || /(?:^\/)|(?::\/\/)/.test(filePath)) {
                        return match;
                    }

                    // create path relative to opts.base
                    var relativeToBase = path.relative(path.resolve(opts.base), path.resolve(path.join(dir, filePath)));
                    var pathPrefix = (typeof opts.pathPrefix === 'undefined') ? '/' : opts.pathPrefix;
                    return file.normalizePath(match.replace(filePath, path.join(pathPrefix, relativeToBase)));
                });
            });

            // combine all css files to one bid stylesheet
        }).reduce(function (total, contents) {
            return total + os.EOL + contents;

            // write contents to tmp file
        }, '').then(function (css) {
            var csspath = tempfile('.css');
            // add file to garbage collector so it get's removed on exit
            gc.addFile(csspath);
            return fs.writeFileAsync(csspath, css).then(function () {
                return csspath;
            });
            // let penthouseAsync do the rest
        }).then(function (csspath) {
            return startServer(opts).then(function (server) {
                debug('Processing: ' + opts.url + ' [' + dimensions.width + 'x' + dimensions.height + ']');
                return penthouseAsync({
                    url: file.getPenthouseUrl(opts, server.port),
                    css: csspath,
                    forceInclude: opts.include || [],
                    maxEmbeddedBase64Length: opts.maxImageFileSize || 10240,
                    // viewport width
                    width: dimensions.width,
                    // viewport height
                    height: dimensions.height
                }).finally(function () {
                    server.instance.close();
                });
            });
        });
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
