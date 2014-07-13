/*
 * critical
 * http://github.com/addyosmani/critical
 *
 * Copyright (c) 2014 Google Inc.
 * Licensed under an Apache 2 license.
 */

'use strict';
var fs = require('fs');
var path = require('path');
var penthouse = require('penthouse');
var CleanCSS = require('clean-css');
var oust = require('oust');
var inliner = require('./inline-styles');

var isWindows = process.platform == 'win32';
var lineBreak = isWindows ? /\r\n/g : /\n/g;
/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */
exports.generate = function (opts, cb) {
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

    var url = path.join(opts.base, opts.src);

    fs.readFile(url, function (err, html) {
        if (err) {
            cb(err);
            return;
        }

//html = html.toString().replace(lineBreak, '');

        // Oust extracts a list of your stylesheets
        var hrefs = oust(html, 'stylesheets');
        // Penthouse then determines your critical
        // path CSS using these as input.
        penthouse({
            url: url,
            css: path.join(opts.base, hrefs[0]),
            // What viewports do you care about?
            width: opts.width,   // viewport width
            height: opts.height  // viewport height
        }, function (err, criticalCSS) {
            if (err) {
                cb(err);
                return;
            }

           criticalCSS = criticalCSS.toString('utf-8').replace(lineBreak, '');

            if (opts.minify === true) {
                criticalCSS = new CleanCSS().minify(criticalCSS);
            }

            if (opts.dest) {
                // Write critical-path CSS
                fs.writeFile(path.join(opts.base, opts.dest), criticalCSS, function (err) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, criticalCSS.toString());
                });
            } else {
                cb(null, criticalCSS.toString());
            }
        });
    });
};

/**
 * Critical path CSS inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, dest
 */
exports.inline = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {};

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

        out = out.toString('utf-8').replace(lineBreak, '');

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
