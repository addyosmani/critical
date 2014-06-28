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
var path      = require('path');
var inliner   = require('inline-styles');

/**
 * Critical path CSS generation & inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */

function Critical(){};

Critical.prototype.generate = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {};
    var url = opts.base + opts.src;
    // Oust extracts a list of your stylesheets
    oust({ src: url }, function (hrefs){
        console.log('List of stylesheets extracted.');
        // Penthouse then determines your critical
        // path CSS using these as input.
        penthouse({
            url : url,
            css : opts.base + hrefs[0],
            // What viewports do you care about?
            width : opts.width,   // viewport width
            height : opts.height   // viewport height
        }, function (err, criticalCSS) {
            console.log('Critical-path CSS generated.');
            // Write critical-path CSS
            fs.writeFileSync(opts.base + opts.dest, criticalCSS);
            cb(criticalCSS);
        }); 
    });  
}

Critical.prototype.inline = function (opts, cb) {
  opts = opts || {};
  cb = cb || function () {};
  var url = opts.base + opts.src;
  // Inline the critical path CSS
  var html = fs.readFileSync(url);
  var out = inliner(html, opts.base);
  // Write HTML with inlined CSS to dest
  fs.writeFileSync(opts.base + opts.dest, out);
  console.log('Critical-path CSS inlined.');
  console.log('Output written to ' + opts.base + opts.dest);
  cb(out);
}

module.exports = Critical;