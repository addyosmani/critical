/*
  This is a fork of the inline-styles module by @maxogden
  with support for minification. The original module can be
  found here: https://github.com/maxogden/inline-styles
*/

var cheerio = require('cheerio');
var path = require('path');
var fs = require('fs');
var url = require('url');
var inliner = require('imageinliner');
var CleanCSS = require('clean-css');

module.exports = function(html, opts) {
  var base = opts.base || process.cwd();
  var minify = opts.minify;
  var maxImageSize = opts.maxImageFileSize || 10240;
  var dom = cheerio.load(String(html));
  injectStyles(dom);
  return new Buffer(dom.html());

  function injectStyles(dom) {
    var styles = [];
    dom('link').each(function(idx, el) {
      el = dom(el);
      var href = el.attr('href');
      if (el.attr('rel') === 'stylesheet' && isLocal(href)) {
        var dir = base + path.dirname(href);
        var file = path.join(base, href);
        var style = fs.readFileSync(file);
        var inlined = inliner.css(style.toString(), { maxImageFileSize: maxImageSize, cssBasePath: dir });
        var inlinedStyles = inlined.toString();
        if (minify) {
          inlinedStyles = new CleanCSS().minify(inlinedStyles);
        }

        inlinedStyles = rebaseRelativePaths(base, dir, inlinedStyles);

        var inlinedTag = "<style>\n" + inlinedStyles + '\n</style>';
        el.replaceWith(inlinedTag);
      }
    })
  }

  function isLocal(href) {
    return href && !url.parse(href).hostname;
  }

  function rebaseRelativePaths(basePath, cssPath, cssStr){
    var base,
        beginsWith,
        nests,
        newPath;
        
    var paths = cssStr.match(/url\((.+?)\)/g);
    var pathDiff = cssPath.replace(basePath).split("/").length;

    if(paths){
      for(var i=0, j=paths.length; i<j; i++){
        paths[i] = paths[i].match(/url\((.+?)\)/)[1];

        beginsWith = paths[i].split('/')[0].replace(/['"]/, "");

        if(beginsWith === '..'){
          newPath = paths[i];
          for(var k=0; k < pathDiff; k++){
            newPath = newPath.replace("../", "");
          }
          cssStr = cssStr.replace(paths[i], newPath);
        }else{
          // the relative path is within the cssPath, so append it
          newPath = cssPath.replace(basePath, "") + "/" + paths[i].replace(/['"]/g, "");
          cssStr = cssStr.replace(paths[i], newPath);
        }
      }
    }
     return cssStr;
  }
};
