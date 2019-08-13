'use strict';

const {EOL} = require('os');
const path = require('path');
const chalk = require('chalk');
const CleanCSS = require('clean-css');
const invokeMap = require('lodash/invokeMap');
const pAll = require('p-all');
const debug = require('debug')('critical:core');
const postcss = require('postcss');
const discard = require('postcss-discard');
const prettier = require('prettier');
const imageInliner = require('postcss-image-inliner');
const penthouse = require('penthouse');
const {PAGE_UNLOADED_DURING_EXECUTION_ERROR_MESSAGE} = require('penthouse/lib/core');
const inlineCritical = require('inline-critical');
const {extractCss} = require('inline-critical/src/css');
const parseCssUrls = require('css-url-parser');
const {reduceAsync} = require('./array');
const {NoCssError} = require('./errors');
const {getDocument, getDocumentFromSource, token, getAssetPaths, isRemote, normalizePath} = require('./file');

/**
 * Returns a string of combined and deduped css rules.
 * @param {array} cssArray Array with css strings
 * @returns {String} combined and deduped css rules
 */
function combineCss(cssArray) {
  if (cssArray.length === 1) {
    return cssArray[0].toString();
  }

  return new CleanCSS({
    level: {
      1: {
        all: true,
      },
      2: {
        all: false,
        removeDuplicateFontRules: true,
        removeDuplicateMediaBlocks: true,
        removeDuplicateRules: true,
        removeEmpty: true,
        mergeMedia: true,
      },
    },
  }).minify(invokeMap(cssArray, 'toString').join(' ')).styles;
}

/**
 * Let penthouse compute the critical css
 * @param {vinyl} document Vinyl representation of the HTML document
 * @param {object} options Options passed to critical
 * @returns {string} Critical css for various dimensions combined and deduped
 */
function callPenthouse(document, options) {
  const {dimensions, width, height, userAgent, user, pass, penthouse: params = {}} = options;
  const {customPageHeaders = {}} = params;
  const {css: cssString, url} = document;
  const config = {...params, cssString, url};
  const sizes = Array.isArray(dimensions) ? dimensions : [{width, height}];
  if (userAgent) {
    config.userAgent = userAgent;
  }

  if (user && pass) {
    config.customPageHeaders = {...customPageHeaders, Authorization: `Basic ${token(user, pass)}`};
  }

  return sizes.map(({width, height}) => () => {
    const result = penthouse({...config, width, height});
    debug('Call penthouse with:', {...config, width, height});

    return result;
  });
}

/**
 * Critical path CSS generation
 * @param  {object} options Options
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise<object>} Object with critical css & html
 */
async function create(options = {}) {
  const cleanCSS = new CleanCSS();
  const {
    base,
    src,
    html,
    inline,
    ignore,
    minify,
    extract,
    target = {},
    inlineImages,
    maxImageFileSize,
    postcss: postProcess = [],
    strict,
    concurrency = Infinity,
    assetPaths = [],
  } = options;

  // Create vinyl representation for the document with normalized filepath and normalized styles
  const document = src ? await getDocument(src, options) : await getDocumentFromSource(html, options);

  if (!document.css || !document.css.toString()) {
    if (strict) {
      throw new NoCssError();
    }

    return {
      css: '',
      html: document.contents.toString(),
    };
  }

  // Generate critical css
  let criticalCSS;
  try {
    const tasks = callPenthouse(document, options);
    const criticalStyles = await pAll(tasks, {concurrency});
    criticalCSS = combineCss(criticalStyles);
  } catch (error) {
    if (error.message === PAGE_UNLOADED_DURING_EXECUTION_ERROR_MESSAGE) {
      process.stderr.write(chalk.yellow(PAGE_UNLOADED_DURING_EXECUTION_ERROR_MESSAGE) + EOL);
      return {
        css: '',
        html: document.contents.toString(),
      };
    }

    throw error;
  }

  // Add postprocess configuration
  if (ignore) {
    postProcess.push(discard(ignore));
  }

  if (inlineImages) {
    const refAssets = [...parseCssUrls(criticalCSS), ...document.stylesheets];
    const refAssetPaths = refAssets.reduce((res, file) => [...res, path.dirname(file)], []);

    const searchpaths = await reduceAsync(
      [...new Set(refAssetPaths)],
      async (res, file) => {
        const paths = await getAssetPaths(document, file, options, false);
        return [...new Set([...res, ...paths])];
      },
      []
    );

    const filtered = searchpaths.filter(p => isRemote(p) || p.includes(process.cwd()) || (base && p.includes(base)));

    const inlineOptions = {
      assetPaths: [...filtered, ...assetPaths],
      maxFileSize: maxImageFileSize,
    };

    debug('Inline images:', inlineOptions, refAssets);

    postProcess.push(imageInliner(inlineOptions));
  }

  // Post-process critical css
  if (postProcess.length > 0) {
    criticalCSS = await postcss(postProcess)
      .process(criticalCSS, {from: undefined})
      .then(contents => contents.css);
  }

  // Minify or prettify
  if (minify) {
    criticalCSS = cleanCSS.minify(criticalCSS).styles;
  } else {
    criticalCSS = prettier.format(criticalCSS, {parser: 'css'});
  }

  const result = {
    css: criticalCSS,
  };

  // Define uncritical as lazy evaluated property
  const lazyUncritical = (orig, diff) =>
    function() {
      if (!this._uncritical) {
        this._uncritical = extractCss(orig, diff);
      }

      return this._uncritical;
    };

  Object.defineProperty(result, 'uncritical', {
    get: lazyUncritical(document.css, criticalCSS),
  });

  // Inline
  if (inline) {
    const {replaceStylesheets} = inline;

    if (typeof replaceStylesheets === 'function') {
      inline.replaceStylesheets = await replaceStylesheets(document, result.uncritical);
    }

    // If replaceStylesheets is not set via option and and uncritical is empty
    if (extract && replaceStylesheets === undefined) {
      if (result.uncritical.trim() === '') {
        inline.replaceStylesheets = [];
      }
    }

    if (target.uncritical) {
      const uncriticalHref = normalizePath(path.relative(document.cwd, path.resolve(base, target.uncritical)));
      // Only replace stylesheets if the uncriticalHref is inside document.cwd and replaceStylesheets is not set via options
      if (!/^\.\.\//.test(uncriticalHref) && replaceStylesheets === undefined) {
        inline.replaceStylesheets = [`/${uncriticalHref}`];
      }
    } else {
      inline.extract = extract;
    }

    const inlined = inlineCritical(document.contents.toString(), criticalCSS, {...inline, basePath: document.cwd});
    document.contents = Buffer.from(inlined);
  }

  // Clean tempfiles
  await document.cleanup();

  result.html = document.contents.toString();

  // Cleanup output
  return result;
}

module.exports = {
  create,
};
