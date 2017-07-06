/*
 This is a fork of the inline-styles module by @maxogden
 with support for minification. The original module can be
 found here: https://github.com/maxogden/inline-styles
 */
'use strict';
const path = require('path');
const fs = require('fs');
const url = require('url');
const cheerio = require('cheerio');
const inliner = require('imageinliner');
const CleanCSS = require('clean-css');

module.exports = function (html, opts) {
    const base = opts.base || process.cwd();
    const minify = opts.minify;
    const maxImageSize = opts.maxImageFileSize || 10240;
    const dom = cheerio.load(String(html), {
        decodeEntities: false
    });

    injectStyles(dom);

    return Buffer.from(dom.html());

    function injectStyles(dom) {
        dom('link').each((idx, el) => {
            el = dom(el);
            const href = el.attr('href');

            if (el.attr('rel') === 'stylesheet' && isLocal(href)) {
                const dir = base + path.dirname(href);
                const file = path.join(base, href);
                const style = fs.readFileSync(file);
                let inlinedStyles;

                // #40 already inlined background images cause problems with imageinliner
                if (opts.inlineImages) {
                    const inlined = inliner.css(style.toString(), {maxImageFileSize: maxImageSize, cssBasePath: dir});
                    inlinedStyles = inlined.toString();
                } else {
                    inlinedStyles = style.toString();
                }

                if (minify) {
                    inlinedStyles = new CleanCSS().minify(inlinedStyles).styles;
                }

                inlinedStyles = rebaseRelativePaths(base, dir, inlinedStyles);

                const inlinedTag = '<style>\n' + inlinedStyles + '\n</style>';
                el.replaceWith(inlinedTag);
            }
        });
    }

    function isLocal(href) {
        return href && !url.parse(href).hostname;
    }

    function rebaseRelativePaths(basePath, cssPath, cssStr) {
        let beginsWith;
        let newPath;
        const paths = cssStr.match(/url\((.+?)\)/g);
        const pathDiff = cssPath.replace(basePath).split('/').length;

        if (paths) {
            for (let i = 0, j = paths.length; i < j; i++) {
                paths[i] = paths[i].match(/url\((.+?)\)/)[1];

                // Do nothing for absolute paths, urls and data-uris
                if (paths[i].startsWith('data:') || /(?:^\/)|(?::\/\/)/.test(paths[i])) {
                    continue;
                }

                beginsWith = paths[i].split('/')[0].replace(/['"]/, '');

                if (beginsWith === '..') {
                    newPath = paths[i];

                    for (let k = 0; k < pathDiff; k++) {
                        newPath = newPath.replace('../', '');
                    }

                    cssStr = cssStr.replace(paths[i], newPath);
                } else {
                    // The relative path is within the cssPath, so append it
                    newPath = cssPath.replace(basePath, '') + '/' + paths[i].replace(/['"]/g, '');
                    cssStr = cssStr.replace(paths[i], newPath);
                }
            }
        }

        return cssStr;
    }
};
