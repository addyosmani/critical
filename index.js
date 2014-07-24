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
var Promise = require("bluebird");
var os = require('os');


// promisify fs
Promise.promisifyAll(fs);

var penthouseAsync = Promise.promisify(penthouse);

var TMPCSS = '.tmp.css';

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */
exports.generate = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {
    };

    if (!opts.src || !opts.base) {
        throw new Error('A valid source and base path are required.');
    }

    if (!opts.height) {
        opts.height = 320;
    }

    if (!opts.width) {
        opts.width = 480;
    }

    var url = path.join(opts.base, opts.src);

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

    // combine all css files to one bid stylesheet
    }).reduce(function (total, fileName) {
        return fs.readFileAsync(fileName, "utf8").then(function (contents) {
            return total + os.EOL + contents;
        });


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

        var out = inliner(data, opts.base, opts.minify);

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
    cb = cb || function () {
    };

    if (!opts.styleTarget || !opts.htmlTarget) {
        throw new Error('Valid style and HTML targets are required.');
    }

    var genOpts = opts;
    var inlineOpts = opts;

    genOpts.dest = opts.styleTarget;

    exports.generate(genOpts, function (err, output) {
        if (err) {
            cb(err);
            return;
        }

        inlineOpts.dest = opts.htmlTarget;
        exports.inline(inlineOpts);
    });
};
