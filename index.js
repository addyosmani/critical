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
var inliner   = require('./inline-styles');
var CleanCSS  = require('clean-css');

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dest
 */
exports.generate = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {}; 

    if (!opts.src && !opts.base) {
        cb(new Error('A valid source and base path are required.'));
        return;
    }

    if (!opts.height) {
        opts.height = 320;
    }

    if (!opts.width) {
        opts.width = 480;
    }

    var url = opts.base + opts.src;
    fs.readFile(url, function (err, html){
      if (err) throw err;
      // Oust extracts a list of your stylesheets      
      var hrefs = oust(html, 'stylesheets');
      // Penthouse then determines your critical
      // path CSS using these as input.
      penthouse({
          url : url,
          css : opts.base + hrefs[0],
          // What viewports do you care about?
          width : opts.width,   // viewport width
          height : opts.height   // viewport height
      }, function (err, criticalCSS) {
          if(opts.minify === true){
            var minimized = new CleanCSS().minify(criticalCSS);
            criticalCSS = minimized;
          }          
          if(opts.dest){
            // Write critical-path CSS
            fs.writeFile(path.join(__dirname, opts.base + opts.dest), criticalCSS, function (err){
              cb(err, criticalCSS)
            });
          } else {
            cb(err, criticalCSS); 
          }
      });   
  });
}

/**
 * Critical path CSS inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, dest
 */
exports.inline = function (opts, cb) {
  opts = opts || {};
  cb = cb || function () {};

  if (!opts.src && !opts.base) {
      cb(new Error('A valid source and base path are required.'));
      return;
  }

  var url = opts.base + opts.src;
  // Inline the critical path CSS
  fs.readFile(url, function (err, data){
    if (err) throw err;
    var out = inliner(data, opts.base, opts.minify);
    if (opts.dest){
      // Write HTML with inlined CSS to dest
      fs.writeFile(path.join(__dirname, opts.base + opts.dest), out, function (err) {
        cb(err, out);
      });
    } else {
        cb(err, out);
    }
  });
}

