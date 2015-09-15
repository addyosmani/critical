'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var _ = require('lodash');
//var tmp = require('tmp');
//var slash = require('slash');
var penthouse = require('penthouse');
var CleanCSS = require('clean-css');
var filterCss = require('filter-css');
var oust = require('oust');
var imageInliner = require('imageinliner');
//var request = require('request');
/* jshint -W079 */
var Promise = require('bluebird');
var tempfile = require('tempfile');
//var url = require('url');
//var mime = require('mime-types');
var file = require('./fileHelper');

// promisify fs and penthouse
Promise.promisifyAll(fs);
var penthouseAsync = Promise.promisify(penthouse);
//var tmpfile = Promise.promisify(tmp.file);



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

///**
// * get path from result array
// * @param resultArray
// * @returns {*}
// */
//function resolveTmp(resultArray) {
//    return _.first(resultArray);
//}
//
//function temp(opts) {
//    return function(resp){
//        var contentType = resp.headers['content-type'];
//        return tmpfile(_.assign(opts,{postfix:'.'+mime.extension(contentType)}))
//            .then(resolveTmp)
//            .then(function (path) {
//                return fs.writeFileAsync(path, resp.body).then(function () {
//                    return path;
//                });
//            });
//    };
//}
//
///**
// * Fixup slashes in file paths for windows
// */
//function normalizePath(str) {
//    return process.platform === 'win32' ? slash(str) : str;
//}
//
///**
// * Check wether a resource is external or not
// * @param href
// * @returns {boolean}
// */
//function isExternal(href) {
//    return /(^\/\/)|(:\/\/)/.test(href);
//}
//
///**
// * Get external resource
// * @param url
// * @returns {bluebird|exports|module.exports}
// */
//function requestAsync(uri) {
//    return new Promise(function (resolve, reject) {
//        // handle protocol-relative urls
//        uri = url.resolve('http://te.st',uri);
//        request(uri, function (err, resp, body) {
//            if (err) {
//                return reject(err);
//            }
//            if (resp.statusCode !== 200) {
//                return reject('Wrong status code ' + resp.statusCode + ' for ' + url);
//            }
//            resolve(resp);
//        });
//    });
//}
//
///**
// *
// * @param base
// * @returns {bluebird|exports|module.exports}
// */
//function assertLocalFile(opts, ext) {
//    return function (filePath) {
//        if (!isExternal(filePath)) {
//            return new Promise(function (resolve) {
//                resolve(filePath);
//            });
//        }
//
//        return requestAsync(filePath)
//            .then(temp({
//                dir: opts.base
//            }));
//    };
//}
//
//function resourcePath(opts){
//    return function(file){
//        if (isExternal(file)) {
//            return file;
//        }
//        if (!isExternal(opts.src)){
//            return path.join(opts.base, file);
//        }
//        return url.resolve(opts.src, file);
//    };
//}




/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise}
 */
function generate(opts) {
    opts = opts || {};

    if (!(opts.src || opts.html) || !opts.base) {
        return Promise.reject(new Error('A valid source and base path are required.'));
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

            // Oust extracts a list of your stylesheets (ignoring remote stylesheets)
            var stylesheets = oust(html.toString(), 'stylesheets').filter(function (href) {
                return true;//!/(^\/\/)|(:\/\/)/.test(href) || isExternal(opts.src) && _.startsWith(href, opts.src);
            }).map(file.resourcePath(opts));

            return Promise.map(stylesheets, file.assertLocal(opts));

        // read files
        }).map(function (fileName) {
            return fs.readFileAsync(fileName, 'utf8').then(function (content) {
                // get path to css file
                var dir = path.dirname(fileName);
                var maxFileSize = opts.maxImageFileSize || 10240;

                // #40 already inlined background images cause problems with imageinliner
                if (opts.inlineImages) {
                    content = imageInliner.css(content.toString(), {
                        maxImageFileSize: maxFileSize,
                        cssBasePath: dir,
                        rootImagePath: opts.base
                    });
                }
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
//exports.getContentPromise = getContentPromise;




