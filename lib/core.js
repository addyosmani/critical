'use strict';
const os = require('os');
const path = require('path');
const url = require('url');
const invokeMap = require('lodash/invokeMap');
const assign = require('lodash/assign');
const uniq = require('lodash/uniq');
const flatten = require('lodash/flatten');
const penthouse = require('ez-penthouse');
const CleanCSS = require('clean-css');
const filterCss = require('filter-css');
const oust = require('oust');
const postcss = require('postcss');
const imageInliner = require('postcss-image-inliner');
const Bluebird = require('bluebird');
const debug = require('debug')('critical:core');
// const validateCss = require('css-validator');
const CSSLint = require('csslint').CSSLint;

const file = require('./file-helper');

/**
 * Returns a string of combined and deduped css rules.
 * @param cssArray
 * @returns {String}
 */
function combineCss(cssArray) {
    if (cssArray.length === 1) {
        return cssArray[0].toString();
    }

    return new CleanCSS({
        level: {
            1: {
                all: true
            },
            2: {
                all: false,
                removeDuplicateFontRules: true,
                removeDuplicateMediaBlocks: true,
                removeDuplicateRules: true,
                removeEmpty: true,
                mergeMedia: true
            }
        }
    }).minify(
        invokeMap(cssArray, 'toString').join(' ')
    ).styles;
}

/**
 * Append stylesheets to result
 * @param opts
 * @returns {function}
 */
function appendStylesheets(opts) {
    return function (htmlfile) {
        // Consider opts.css and map to array if it isn't one
        if (opts.css) {
            const css = Array.isArray(opts.css) ? opts.css : [opts.css];
            return Bluebird.map(css, stylesheet => file.assertLocal(stylesheet, opts)).then(stylesheets => {
                htmlfile.stylesheets = stylesheets;
                return htmlfile;
            });
        }

        // Oust extracts a list of your stylesheets
        let stylesheets = flatten([
            oust.raw(htmlfile.contents.toString(), 'stylesheets'),
            oust.raw(htmlfile.contents.toString(), 'preload')
        ]).filter(link => link.$el.attr('media') !== 'print' && Boolean(link.value)).map(link => link.value);

        stylesheets = uniq(stylesheets).map(file.resourcePath(htmlfile, opts));
		debug('appendStylesheets', stylesheets);
		return validateStylesheets(htmlfile, stylesheets, opts);

		/*
        if (stylesheets.length === 0) {
            return Promise.reject(new Error('No usable stylesheets found in html source. Try to specify the stylesheets manually.'));
        }

        return Bluebird.map(stylesheets, stylesheet => file.assertLocal(stylesheet, opts)).then(stylesheets => {
            htmlfile.stylesheets = stylesheets;
            return htmlfile;
        });
		*/
    };
}

/**
 * Validate stylesheets
 * @param opts
 * @returns {function}
 */
async function validateStylesheets(htmlfile, stylesheets, opts) {
	if (stylesheets.length === 0) {
		return Promise.reject(new Error('No usable stylesheets found in html source. Try to specify the stylesheets manually.'));
	}
	// TO DO: figure out how to allow CSS Lint to detect/check inline CSS inside an HTML doc
	// stylesheets.push(opts.src);
	var allErrors = [];
	var total = stylesheets.length;
	var completed = 0;
	var promiseArray = [];
	stylesheets.forEach(function(stylesheet) {
		/*
		promiseArray.push(new Promise((resolve, reject) => {
			validateCss(
				{
					uri: stylesheet,
					// profile: 'css3',
					w3cUrl: '',
					vextwarning: true
				},
				function (err, data) {
					data.errors.forEach(function(cssError, idx) {
						data.errors[idx].src = stylesheet;
					});
					allErrors = allErrors.concat(data.errors);
					completed++;
					if (completed >= total) {
						if (allErrors.length < 1) {
							return Bluebird.map(stylesheets, stylesheet => file.assertLocal(stylesheet, opts)).then(stylesheets => {
								htmlfile.stylesheets = stylesheets;
								return Promise.reject(new Error('U WOT M8???'));
								// return htmlfile;
							});
						}
						else {
							return Promise.reject(new Error(JSON.stringify(allErrors)));
						}
					}
				}
			);
		}));
		*/
		promiseArray.push(new Promise((resolve, reject) => {
			file.requestAsync(stylesheet).then(function(response) {
				var result = CSSLint.verify(response.body);
				result.messages.forEach(function(resultMessage) {
					if (resultMessage.type == 'error') {
						resultMessage.src = response.url;
						allErrors.push(resultMessage);
					}
				});
				completed++;
				if (completed >= total) {
					debug('validateStylesheets - allErrors', allErrors);
					return Promise.reject(new Error('U WOT M8???'));
				}
			});
		}));
	});
	await Promise.all(promiseArray);
	return Promise.reject(new Error('WTF??  This should not happen.'));
}

/**
 * Inline images using postcss-image-inliner
 * @param opts
 * @returns {function}
 */
function inlineImages(opts) {
    return function (vinyl) {
        if (opts.inlineImages) {
            const assetPaths = opts.assetPaths || [];

            // Add some suitable fallbacks for convinience if nothing is set.
            // Otherwise don't add them to keep the user in control
            if (assetPaths.length === 0) {
                assetPaths.push(path.dirname(vinyl.path));
                // Add domain as asset source for external domains
                if (file.isExternal(opts.src)) {
                    const urlObj = url.parse(opts.src);
                    const domain = urlObj.protocol + '//' + urlObj.host;
                    assetPaths.push(domain, domain + path.dirname(urlObj.pathname));
                }

                if (opts.base) {
                    assetPaths.push(opts.base);
                }
            }

            const inlineOptions = {
                assetPaths: uniq(assetPaths),
                maxFileSize: opts.maxImageFileSize || 10240
            };
            debug('inlineImages', inlineOptions);
            return postcss([imageInliner(inlineOptions)])
                .process(vinyl.contents.toString('utf8'))
                .then(contents => {
                    vinyl.contents = Buffer.from(contents.css);
                    return vinyl;
                });
        }

        return vinyl;
    };
}

/**
 * Helper function create vinyl objects
 * @param opts
 * @returns {function}
 */
function vinylize(opts) {
    return function (filepath) {
        if (filepath._isVinyl) {
            return filepath;
        }
        debug('vinylize', path.resolve(filepath));
        return file.getVinylPromise({
            src: path.resolve(filepath),
            base: opts.base
        });
    };
}

/**
 * Read css source, inline images and normalize relative paths
 * @param opts
 * @returns {function}
 */
function processStylesheets(opts) {
    return function (htmlfile) {
        debug('processStylesheets', htmlfile.stylesheets);
        return Bluebird.map(htmlfile.stylesheets, vinylize(opts))
            .map(inlineImages(opts))
            .map(file.replaceAssetPaths(htmlfile, opts))
            .reduce((total, stylesheet) => {
                return total + os.EOL + stylesheet.contents.toString('utf8');
            }, '')
            .then(css => {
                htmlfile.cssString = css;
                return htmlfile;
            });
    };
}

/**
 * Fire up a server as pentouse doesn't like filesystem paths on windows
 * and let pentouse compute the critical css for us
 * @param dimensions
 * @param {object} opts Options passed to critical
 * @returns {function}
 */
function computeCritical(dimensions, opts) {
    return function (htmlfile) {
        debug('Processing: ' + htmlfile.path + ' [' + dimensions.width + 'x' + dimensions.height + ']');
        const penthouseOpts = assign({}, opts.penthouse, {
            url: file.getPenthouseUrl(opts, htmlfile),
            html: opts.html,
            htmlContentURL: opts.htmlContentURL,
            blockRequestURLs: opts.blockRequestURLs,
            cssString: htmlfile.cssString,
            width: dimensions.width,
            height: dimensions.height,
            userAgent: opts.userAgent
        });

        if (opts.user && opts.pass) {
            penthouseOpts.customPageHeaders = {Authorization: 'Basic ' + file.token(opts.user, opts.pass)};
        }

        return penthouse(penthouseOpts);
    };
}

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise}
 */
function generate(opts) {
    const cleanCSS = new CleanCSS();
    opts = opts || {};

    if (!opts.src && !opts.html) {
        return Bluebird.reject(new Error('A valid source is required.'));
    }

    if (!opts.dimensions) {
        opts.dimensions = [{
            height: opts.height || 900,
            width: opts.width || 1300
        }];
    }

    debug('Start with the following options');
    debug(opts);

    return Bluebird.map(opts.dimensions, dimensions => {
        // Use content to fetch used css files
        return file.getVinylPromise(opts)
            .then(appendStylesheets(opts))
            .then(processStylesheets(opts))
            .then(computeCritical(dimensions, opts));
    }).then(criticalCSS => {
        criticalCSS = combineCss(criticalCSS);

        if (opts.ignore) {
            debug('generate', 'Applying filter', opts.ignore);
            criticalCSS = filterCss(criticalCSS, opts.ignore, opts.ignoreOptions || {});
        }

        debug('generate', 'Minify css');
        criticalCSS = cleanCSS.minify(criticalCSS).styles;

        debug('generate', 'Done');
        return criticalCSS;
    }).catch(err => {
        if (err.message.startsWith('PAGE_UNLOADED_DURING_EXECUTION')) {
            return '';
        }
        return Promise.reject(err);
    });
}

exports.appendStylesheets = appendStylesheets;
exports.generate = generate;
