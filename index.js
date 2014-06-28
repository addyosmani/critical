/*
 * critical
 * http://github.com/addyosmani/critical
 *
 * Copyright (c) 2014 Google Inc.
 * Licensed under an Apache 2 license.
 */

'use strict';
var oust      = require('oust');
var penthouse = require('penthouse');
var fs        = require('fs');
var cheerio   = require('cheerio');
var path      = require('path');
var inliner   = require('inline-styles');

/**
 * Critical path CSS generation & inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */

module.exports = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {};
    // Oust extracts a list of your stylesheets
    oust({ src: opts.src }, function (hrefs){
        console.log('List of stylesheets extracted.');
        // Penthouse then determines your critical
        // path CSS using these as input.
        penthouse({
            url : opts.src,
            css : opts.base + hrefs[0],
            // What viewports do you care about?
            width : opts.width,   // viewport width
            height : opts.height   // viewport height
        }, function (err, criticalCSS) {
            console.log('Critical-path CSS generated.');
            // Write critical-path CSS
            fs.writeFile(opts.styleOutput, criticalCSS, function (err) {
              if (err) return console.log(err);
              // Inline the critical path CSS
              var html = fs.readFileSync(opts.src);
              var out = inliner(html, opts.base);
              // Write HTML with inlined CSS to dest
              fs.writeFileSync(opts.dest, out);
              console.log('Critical-path CSS inlined.');
              console.log('Output written to ' + opts.dest);
              cb(out, err);
            });       
        }); 
    });  
}
