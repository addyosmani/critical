var cheerio = require('cheerio');
var path = require('path');
// Fork of inline-styles with minification support
var fs = require('fs');
var url = require('url');
var inliner = require('imageinliner');
var CleanCSS = require('clean-css');

module.exports = function(html, base, minify) {
  base = base || process.cwd();
  var dom = cheerio.load(String(html));
  injectStyles(dom);
  return new Buffer(dom.html());

  function injectStyles(dom) {
    var styles = [];
    dom('link').each(function(idx, el) {
      el = dom(el);
      var href = el.attr('href');
      if (el.attr('rel') === 'stylesheet' && isLocal(href)) {
        var dir = path.dirname(href);
        var file = path.join(base, href);
        var style = fs.readFileSync(file);
        var inlined = inliner.css(style.toString(), { cssBasePath: dir });
        var inlinedStyles = inlined.toString();
        if (minify) {
          inlinedStyles = new CleanCSS().minify(inlinedStyles);
        }
        var inlinedTag = "<style>\n" + inlinedStyles + '\n</style>';
        el.replaceWith(inlinedTag);
      }
    })
  }

  function isLocal(href) {
    return href && !url.parse(href).hostname;
  }

};
