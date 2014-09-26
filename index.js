/*
 * critical
 * http://github.com/addyosmani/critical
 */

'use strict';
var fs = require('fs');
var path = require('path');
var penthouse = require('penthouse');
var CleanCSS = require('clean-css');
var oust = require('oust');
var inliner = require('./inline-styles');
var sourceInliner = require('inline-critical');
var imageInliner = require('imageinliner');
var Promise = require("bluebird");
var os = require('os');
var uuid = require('uuid');


// promisify fs and penthouse
Promise.promisifyAll(fs);
var penthouseAsync = Promise.promisify(penthouse);


/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */
exports.generate = function (opts, cb) {
    var TMPCSS = '.' + uuid.v4();
    opts = opts || {};
    cb = cb || function () {};

    if (!opts.src || !opts.base) {
        throw new Error('A valid source and base path are required.');
    }

    if (!opts.height) {
        opts.height = 320;
    }

    if (!opts.width) {
        opts.width = 480;
    }

    // src can either be absolute or relative to opts.base
    var url = opts.src;
    if (opts.src !== path.resolve(opts.src)) {
        url = path.join(opts.base,opts.src);
    }

    // read html file to get css files
    fs.readFileAsync(url).then(function (html) {
        // consider opts.css and map to array if it's a string
        if (opts.css) {
            return (typeof opts.css === 'string') ? [opts.css] : opts.css;
        } else {
            // Oust extracts a list of your stylesheets
            return oust(html.toString('utf8'), 'stylesheets').map(function (href) {
                return path.join(opts.base, href);
            });
        }
    // read files
    }).map(function(fileName){
        return fs.readFileAsync(fileName, "utf8").then(function(content) {
            // get path to css file
            var dir = path.dirname(fileName);
            var maxFileSize = opts.maxImageFileSize || 10240;

            // #40 already inlined background images cause problems with imageinliner
            if (opts.inlineImages) {
                content = imageInliner.css(content.toString(), { maxImageFileSize: maxFileSize, cssBasePath: dir, rootImagePath: opts.base });
            }

            // normalize relative paths
            return content.toString().replace(/url\(['"]?([^'"\)]+)['"]?\)/g, function (match, filePath) {
                // do nothing for absolute paths, urls and data-uris
                if (/^data\:/.test(filePath) || /(?:^\/)|(?:\:\/\/)/.test(filePath)) {
                    return match;
                }
                // create path relative to opts.base
                var relativeToBase = path.relative(path.resolve(opts.base), path.resolve(path.join(dir, filePath)));

                // prepend / to make it absolute
                return match.replace(filePath, path.join('/', relativeToBase));
            });
        });

    // combine all css files to one bid stylesheet
    }).reduce(function (total, contents) {
        return total + os.EOL + contents;

    // write contents to tmp file
    }, '').then(function (css) {
        return fs.writeFileAsync(TMPCSS, css);


    // let penthouseAsync do the rest
    }).then(function () {
        return penthouseAsync({
            url: url,
            css: TMPCSS,
            // What viewports do you care about?
            width: opts.width,   // viewport width
            height: opts.height  // viewport height
        });

    // cleanup tmp css
    }).then(function (criticalCSS) {
        return fs.unlinkAsync(TMPCSS).then(function () {
            return criticalCSS;
        });


    // Penthouse callback
    }).then(function (criticalCSS) {
        if (opts.minify === true) {
            criticalCSS = new CleanCSS().minify(criticalCSS);
        }

        if (opts.dest) {
            // Write critical-path CSS
            return fs.writeFileAsync(path.join(opts.base, opts.dest), criticalCSS).then(function () {
                return criticalCSS;
            });
        } else {
            return criticalCSS;
        }

    // return err on error
    }).catch(function (err) {
        cb(err);

    // callback success
    }).then(function (criticalCSS) {
        cb(null, criticalCSS.toString());

    }).done();
};

/**
 * Critical path CSS inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, dest
 */
exports.inline = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {
    };

    if (!opts.src || !opts.base) {
        throw new Error('A valid source and base path are required.');
    }

    // Inline the critical path CSS
    fs.readFile(path.join(opts.base, opts.src), function (err, data) {
        if (err) {
            cb(err);
            return;
        }

        var out = inliner(data, opts);

        if (opts.dest) {
            // Write HTML with inlined CSS to dest
            fs.writeFile(path.join(opts.base, opts.dest), out, function (err) {
                if (err) {
                    cb(err);
                    return;
                }

                cb(null, out.toString());
            });
        } else {
            cb(null, out.toString());
        }
    });
};

/**
 * Generate and inline critical-path CSS
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, styleTarget, htmlTarget
 */
exports.generateInline = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {};

    var genOpts = opts;
    genOpts.dest = opts.styleTarget || '';

    exports.generate(genOpts, function (err, output) {
        if (err) {
            cb(err);
            return;
        }

        // Inline generated css
        fs.readFileAsync(path.join(opts.base, opts.src))
        .then(function (html) {
            return sourceInliner(html, output, opts.minify);
        }).then(function (final) {
            if (opts.htmlTarget) {
                return fs.writeFileAsync(path.join(opts.base, opts.htmlTarget), final).then(function () {
                    return final;
                });
            } else {
                return final;
            }
        // error callback
        }).catch(function (err) {
            cb(err);
        // callback success
        }).then(function (final) {
            cb(null, final.toString());
        }).done();
    });
};
