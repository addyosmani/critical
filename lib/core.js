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
    if (cssArray.length == 1) {
        return cssArray[0].toString();
    }

    return new CleanCSS({mediaMerging: true}).minify(
        _.invoke(cssArray, 'toString').join(' ')
    ).styles;
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
            height: opts.height || 1300,
            width: opts.width || 900
        }];
    }

    return Promise.map(opts.dimensions, function (dimensions) {
        // use content to fetch used css files
        return file.getContentPromise(opts).then(function (html) {
            // consider opts.css and map to array if it's a string
            if (opts.css) {
                return typeof opts.css === 'string' ? [opts.css] : opts.css;
            }

            // Oust extracts a list of your stylesheets
            var stylesheets = oust(html.toString(), 'stylesheets').map(file.resourcePath(opts));
            return Promise.map(stylesheets, file.assertLocal(opts));
            // read files
        }).map(function (fileName) {
            return fs.readFileAsync(fileName, 'utf8').then(function (content) {
                // get path to css file
                var dir = path.dirname(fileName);

                if (opts.inlineImages) {
                    return postcss([imageInliner({
                        assetPaths: _.unique((opts.assetPaths || []).concat([dir, opts.base])),
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
                    if (/^data\:/.test(filePath) || /(?:^\/)|(?:\:\/\/)/.test(filePath)) {
                        return match;
                    }

                    // create path relative to opts.base
                    var relativeToBase = path.relative(path.resolve(opts.base), path.resolve(path.join(dir, filePath)));
                    var pathPrefix = (typeof opts.pathPrefix === "undefined") ? "/" : opts.pathPrefix;
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
            return penthouseAsync({
                url: file.normalizePath(opts.url),
                css: csspath,
                // What viewports do you care about?
                width: dimensions.width,   // viewport width
                height: dimensions.height  // viewport height
            });
        });
    }).then(function (criticalCSS) {
        criticalCSS = combineCss(criticalCSS);

        if (opts.ignore) {
            criticalCSS = filterCss(criticalCSS, opts.ignore, opts.ignoreOptions || {});
        }

        if (opts.minify === true) {
            criticalCSS = new CleanCSS().minify(criticalCSS).styles;
        }
        return criticalCSS;

    });
}

exports.generate = generate;
