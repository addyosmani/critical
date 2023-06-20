<<<<<<< HEAD
import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import {promisify} from 'node:util';
import parseCssUrls from 'css-url-parser';
import dataUriToBuffer from 'data-uri-to-buffer';
import debugBase from 'debug';
import {findUp} from 'find-up';
import {globby} from 'globby';
import got from 'got';
import isGlob from 'is-glob';
import makeDir from 'make-dir';
import oust from 'oust';
import pico from 'picocolors';
import postcss from 'postcss';
import postcssUrl from 'postcss-url';
import slash from 'slash';
import {temporaryDirectory, temporaryFile} from 'tempy';
import Vinyl from 'vinyl';
import {filterAsync, forEachAsync, mapAsync, reduceAsync} from './array.js';
import {FileNotFoundError} from './errors.js';

const debug = debugBase('critical:file');

export const BASE_WARNING = `${pico.yellow(
  'Warning:'
)} Missing base path. Consider 'base' option. https://goo.gl/PwvFVb`;

const warn = (text) => process.stderr.write(pico.yellow(`${text}${os.EOL}`));
=======
/* eslint-disable complexity */

import process from 'node:process';
import {Buffer} from 'node:buffer';
import {dirname, join, isAbsolute as _isAbsolute, resolve as _resolve, relative, basename, sep} from 'node:path';
import {EOL} from 'node:os';
import {format} from 'node:url';
import {unlink, readFile, writeFile, existsSync} from 'node:fs';
import {promisify} from 'node:util';
import dataUriToBuffer from 'data-uri-to-buffer';
import {findUp} from 'find-up';
import makeDir from 'make-dir';
import {globby} from 'globby';
import isGlob from 'is-glob';
import postcss from 'postcss';
import postcssUrl from 'postcss-url';
import Vinyl from 'vinyl';
import {raw} from 'oust';
import got from 'got';
import debugModule from 'debug';
import chalk from 'chalk';
import parseCssUrls from 'css-url-parser';
import {temporaryDirectory, temporaryFile} from 'tempy';
import slash from 'slash';
import {mapAsync, filterAsync, reduceAsync, forEachAsync} from './array.js';
import {FileNotFoundError} from './errors.js';

const {isVinyl: _isVinyl} = Vinyl;
const debug = debugModule('critical:file');

export const BASE_WARNING = `${chalk.yellow(
  'Warning:'
)} Missing base path. Consider 'base' option. https://goo.gl/PwvFVb`;
>>>>>>> origin/feature/bump

const warn = (text) => process.stderr.write(chalk.yellow(`${text}${EOL}`));

<<<<<<< HEAD
export const checkCssOption = (css) => Boolean((!Array.isArray(css) && css) || (Array.isArray(css) && css.length > 0));

export async function outputFileAsync(file, data) {
  const dir = path.dirname(file);
=======
const unlinkAsync = promisify(unlink);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
>>>>>>> origin/feature/bump

export async function outputFileAsync(file, data) {
  const dir = dirname(file);

  if (!existsSync(dir)) {
    await makeDir(dir);
  }

  return writeFileAsync(file, data);
}

/**
 * Fixup slashes in file paths for Windows and remove volume definition in front
 * @param {string} str Path
 * @returns {string} Normalized path
 */
export function normalizePath(str) {
  return process.platform === 'win32' ? slash(str.replace(/^[a-zA-Z]:/, '')) : str;
}

/**
 * Check whether a resource is external or not
 * @param {string} href Path
 * @returns {boolean} True if the path is remote
 */
export function isRemote(href) {
  return !Buffer.isBuffer(href) && /(^\/\/)|(:\/\/)/.test(href) && !href.startsWith('file:');
}

/**
 * Parse Url
 * @param {string} str The URL
 * @returns {URL|object} return new URL Object
 */
export function urlParse(str = '') {
  if (/^\w+:\/\//.test(str)) {
    return new URL(str);
  }

  if (/^\/\//.test(str)) {
    return new URL(str, 'https://ba.se');
  }

  return {pathname: str};
}

/**
 * Get file uri considering OS
 * @param {string} file Absolute filepath
 * @returns {string} file uri
 */
function getFileUri(file) {
  if (!isAbsolute) {
    throw new Error('Path must be absolute to compute file uri');
  }

  const fileUrl = process.platform === 'win32' ? new URL(`file:///${file}`) : new URL(`file://${file}`);

  return fileUrl.href;
}

/**
 * Resolve Url
 * @param {string} from Resolve from
 * @param {string} to Resolve to
 * @returns {string} The resolved url
 */
export function urlResolve(from = '', to = '') {
  if (isRemote(from)) {
    const {href: base} = urlParse(from);
    const {href} = new URL(to, base);
    return href;
  }

  if (isAbsolute(to)) {
    return to;
  }

  return join(from.replace(/[^/]+$/, ''), to);
}

export function isAbsolute(href) {
  return !Buffer.isBuffer(href) && _isAbsolute(href);
}

/**
 * Check whether a resource is relative or not
 * @param {string} href Path
 * @returns {boolean} True if the path is relative
 */
export function isRelative(href) {
  return !Buffer.isBuffer(href) && !isRemote(href) && !isAbsolute(href);
}

/**
 * Wrapper for File.isVinyl to detect vinyl objects generated by gulp (vinyl < v0.5.6)
 * @param {*} file Object to check
 * @returns {boolean} True if it's a valid vinyl object
 */
function isVinyl(file) {
  return (
    _isVinyl(file) ||
    file instanceof Vinyl ||
    (file && /function File\(/.test(file.constructor.toString()) && file.contents && file.path)
  );
}

/**
 * Check if a file exists (remote & local)
 * @param {string} href Path
 * @param {object} options Critical options
 * @returns {Promise<boolean>} Resolves to true if the file exists
 */
export async function fileExists(href, options = {}) {
  if (isVinyl(href)) {
    return !href.isNull();
  }

  if (Buffer.isBuffer(href)) {
    return true;
  }

  if (isRemote(href)) {
    const {request = {}} = options;
    const method = request.method || 'head';
    try {
      const response = await fetch(href, {...options, request: {...request, method}});
      const {statusCode} = response;

      if (method === 'head') {
        return Number.parseInt(statusCode, 10) < 400;
      }

      return Boolean(response);
    } catch {
      return false;
    }
  }

  return existsSync(href) || existsSync(href.replace(/\?.*$/, ''));
}

/**
 * Remove temporary files
 * @param {array} files Array of temp files
 * @returns {Promise<void>|*} Promise resolves when all files removed
 */
const getCleanup = (files) => () =>
  forEachAsync(files, (file) => {
    try {
      unlinkAsync(file);
    } catch {
      debug(`${file} was already deleted`);
    }
  });

/**
 * Path join considering urls
 * @param {string} base Base path part
 * @param {string} part Path part to append
 * @returns {string} Joined path/url
 */
export function joinPath(base, part) {
  if (!part) {
    return base;
  }

  if (isRemote(base)) {
    return urlResolve(base, part);
  }

  return join(base, part.replace(/\?.*$/, ''));
}

/**
 * Resolve path
 * @param {string} href Path
 * @param {[string]} search Paths to search in
 * @param {object} options Critical options
 * @returns {Promise<string>} Resolves to found path, rejects with FileNotFoundError otherwise
 */
export async function resolve(href, search = [], options = {}) {
  let exists = await fileExists(href, options);
  if (exists) {
    return href;
  }

  for (const ref of search) {
    const checkPath = joinPath(ref, href);
    exists = await fileExists(checkPath, options); /* eslint-disable-line no-await-in-loop */
    if (exists) {
      return checkPath;
    }
  }

  throw new FileNotFoundError(href, search);
}

/**
 * Glob pattern
 * @param {array|string} pattern Glob pattern
 * @param {string} base Critical base option
 * @returns {Promise<[string]>} Found files
 */
function glob(pattern, {base} = {}) {
  // Evaluate globs based on base path
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  // Prepend base if it's not empty & not remote
  const prependBase = (pattern) => (base && !isRemote(base) ? [join(base, pattern)] : []);

  return reduceAsync([], patterns, async (files, pattern) => {
    if (isGlob(pattern)) {
      const result = await globby([...prependBase(pattern), pattern]);
      return [...files, ...result];
    }

    return [...files, pattern];
  });
}

/**
 * Rebase image url in css
 *
 * @param {Buffer|string} css Stylesheet
 * @param {string} from Rebase from url
 * @param {string} to Rebase to url
 * @param {opject} options
 *    method: {string|function} method Rebase method. See https://github.com/postcss/postcss-url#options-combinations
 *    strict: fail on invalid css
 *    inlined: boolean flag indicating inlined css
 * @param {boolean} strict fail on invalid css
 * @returns {Buffer} Rebased css
 */
async function rebaseAssets(css, from, to, options = {}) {
  const {method = 'rebase', strict = false, inlined = false} = options;
  let rebased = css.toString();

  debug('Rebase assets', {from, to});

  if (/\/$/.test(to)) {
    to += 'temp.html';
  }

  if (/\/$/.test(from)) {
    from += 'temp.css';
  }

  if (isRemote(from)) {
    const {pathname} = urlParse(from);
    from = pathname;
  }

  try {
    if (typeof method === 'function') {
      const transform = (asset, ...rest) => {
        const assetNormalized = {
          ...asset,
          absolutePath: normalizePath(asset.absolutePath),
          relativePath: normalizePath(asset.relativePath),
        };

        return method(assetNormalized, ...rest);
      };

      const result = await postcss()
        .use(postcssUrl({url: transform}))
        .process(css, {from, to});
      rebased = result.css;
    } else if (from && to) {
      const result = await postcss()
        .use(postcssUrl({url: method}))
        .process(css, {from, to});
      rebased = result.css;
    }
  } catch (error) {
    if (strict) {
      if (inlined) {
        error.message = error.message.replace(from, 'Inlined stylesheet');
      }

      throw error;
    }

    debug(`CSS parse error: ${error.message}`);
    rebased = '';
  }

  return Buffer.from(rebased);
}

/**
 * Token generated by concatenating username and password with `:` character within a base64 encoded string.
 * @param  {String} user User identifier.
 * @param  {String} pass Password.
 * @returns {String} Base64 encoded authentication token.
 */
export const token = (user, pass) => Buffer.from([user, pass].join(':')).toString('base64');

/**
 * Get external resource. Try https and falls back to http
 * @param {string} uri Source uri
 * @param {object} options Options passed to critical
 * @param {boolean} secure Use https?
 * @returns {Promise<Buffer|response>} Resolves to fetched content or response object for HEAD request
 */
async function fetch(uri, options = {}, secure = true) {
  const {user, pass, userAgent, request: requestOptions = {}} = options;
  const {headers = {}, method = 'get', https} = requestOptions;
  let resourceUrl = uri;
  let protocolRelative = false;

  // Consider protocol-relative urls
  if (/^\/\//.test(uri)) {
    protocolRelative = true;
    resourceUrl = urlResolve(`http${secure ? 's' : ''}://te.st`, uri);
  }

  requestOptions.https = {rejectUnauthorized: true, ...https};
  if (user && pass) {
    headers.Authorization = `Basic ${token(user, pass)}`;
  }

  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  debug(`Fetching resource: ${resourceUrl}`, {...requestOptions, headers});

  try {
    const response = await got(resourceUrl, {...requestOptions, headers});
    if (method === 'head') {
      return response;
    }

    return Buffer.from(response.body || '');
  } catch (error) {
    // Try again with http
    if (secure && protocolRelative) {
      debug(`${error.message} - trying again over http`);
      return fetch(uri, options, false);
    }

    debug(`${resourceUrl} failed: ${error.message}`);

    if (method === 'head') {
      return error.response;
    }

    if (error.response) {
      return Buffer.from(error.response.body || '');
    }

    throw error;
  }
}

/**
 * Extract stylesheet urls from html document
 * @param {Vinyl} file Vinyl file object (document)
 * @param {object} options Options passed to critical
 * @returns {[string]} Stylesheet urls from document source
 */
function getStylesheetObjects(file, options) {
  const {ignoreInlinedStyles} = options || {};
  if (!isVinyl(file)) {
    throw new Error('Parameter file needs to be a vinyl object');
  }

  if (file.stylesheetObjects) {
    return file.stylesheetObjects;
  }

  const stylesheets = raw(file.contents.toString(), ['stylesheets', 'preload', 'styles']);

  const isNotPrint = (el) =>
    el.attr('media') !== 'print' || (Boolean(el.attr('onload')) && el.attr('onload').includes('media'));

  const isMediaQuery = (media) => typeof media === 'string' && !['all', 'print', 'screen'].includes(media);

  const allowedInlinedStylesheet = (type) => type !== 'styles' || !ignoreInlinedStyles;

  const objects = stylesheets
    .filter((link) => isNotPrint(link.$el) && Boolean(link.value) && allowedInlinedStylesheet(link.type))
    .map((link) => {
      const media = isMediaQuery(link.$el.attr('media')) ? link.$el.attr('media') : '';

      // support base64 encoded styles
      if (link.value.startsWith('data:')) {
        return {
          media,
          value: dataUriToBuffer(link.value),
        };
      }

      if (link.type === 'styles') {
        return {
          media,
          value: Buffer.from(link.value),
        };
      }

      return {
        media,
        value: link.value,
      };
    });

  const isEqual = (a, b) => Buffer.from(a).compare(Buffer.from(b)) === 0;
  const compare = (a, b) => isEqual(a.media, b.media) && isEqual(a.value, b.value);
  // Make objects unique
  const stylesheetObjects = objects.filter((a, index, array) => {
    return array.findIndex((b) => compare(a, b)) === index;
  });

  // cache them for later use
  file.stylesheetObjects = stylesheetObjects;

  return stylesheetObjects;
}

/**
 * Extract stylesheet urls from html document
 * @param {Vinyl} file Vinyl file object (document)
 * @param {object} options Options passed to critical
 * @returns {[string]} Stylesheet urls from document source
 */
<<<<<<< HEAD
export function getStylesheetHrefs(file, options) {
  return getStylesheetObjects(file, options).map((object) => object.value);
=======
export function getStylesheetHrefs(file) {
  return getStylesheetObjects(file).map((object) => object.value);
>>>>>>> origin/feature/bump
}

/**
 * Extract stylesheet urls from html document
 * @param {Vinyl} file Vinyl file object (document)
 * @param {object} options Options passed to critical
 * @returns {[string]} Stylesheet urls from document source
 */
export function getStylesheetsMedia(file, options) {
  return getStylesheetObjects(file, options).map((object) => object.media);
}

/**
 * Extract asset urls from stylesheet
 * @param {Vinyl} file Vinyl file object (stylesheet)
 * @returns {[string]} Asset urls from stylesheet source
 */
export function getAssets(file) {
  if (!isVinyl(file)) {
    throw new Error('Parameter file needs to be a vinyl object');
  }

  return parseCssUrls(file.contents.toString());
}

/**
 * Compute Path to Html document based on docroot
 * @param {Vinyl} file The file we want to check
 * @param {object} options Critical options object
 * @returns {Promise<string>} Computed path
 */
export async function getDocumentPath(file, options = {}) {
  let {base} = options;

  // Check remote
  if (file.remote) {
    let {pathname} = file.urlObj;
    if (/\/$/.test(pathname)) {
      pathname += 'index.html';
    }

    return pathname;
  }

  // If we don't have a file path and
  if (!file.path) {
    return '';
  }

  if (base) {
    base = _resolve(base);
    return normalizePath(`/${relative(base, file.path || base)}`);
  }

  // Check local and assume base path based on relative stylesheets
  if (file.stylesheets) {
    const relativeRefs = file.stylesheets.filter((href) => isRelative(href));
    const absoluteRefs = file.stylesheets.filter((href) => isAbsolute(href));
    // If we have no stylesheets inside, fall back to path relative to process cwd
    if (relativeRefs.length === 0 && absoluteRefs.length === 0) {
      process.stderr.write(BASE_WARNING);

      return normalizePath(`/${relative(process.cwd(), file.path)}`);
    }

    // Compute base path based on absolute links
    if (relativeRefs.length === 0) {
      const [ref] = absoluteRefs;
      const paths = await getAssetPaths(file, ref, options);
      try {
        const filepath = await resolve(ref, paths, options);
        return normalizePath(`/${relative(normalizePath(filepath).replace(ref, ''), file.path)}`);
      } catch {
        process.stderr.write(BASE_WARNING);

        return normalizePath(`/${relative(process.cwd(), file.path)}`);
      }
    }

    // Compute path based on relative stylesheet links
    const dots = relativeRefs.reduce((res, href) => {
      const match = /^(\.\.\/)+/.exec(href);

      return match && match[0].length > res.length ? match[0] : res;
    }, './');

    const tmpBase = _resolve(dirname(file.path), dots);

    return normalizePath(`/${relative(tmpBase, file.path)}`);
  }

  return '';
}

/**
 * Get path for remote stylesheet. Compares document host with stylesheet host
 * @param {object} fileObj Result of urlParse(style url)
 * @param {object} documentObj Result of urlParse(document url)
 * @param {string} filename Filename
 * @returns {string} Path to css (can be remote or local relative to document base)
 */
function getRemoteStylesheetPath(fileObj, documentObj, filename) {
  let {hostname: styleHost, port: stylePort, pathname} = fileObj;
  const {hostname: docHost, port: docPort} = documentObj || {};

  if (filename) {
    pathname = joinPath(dirname(pathname), basename(filename));
    fileObj.pathname = normalizePath(pathname);
  }

  if (`${styleHost}:${stylePort}` === `${docHost}:${docPort}`) {
    return pathname;
  }

  return format(fileObj);
}

/**
 * Get path to stylesheet based on docroot
 * @param {Vinyl} document Optional reference document
 * @param {Vinyl} file the file we want to check
 * @param {object} options Critical options object
 * @returns {Promise<string>} Computed path
 */
export function getStylesheetPath(document, file, options = {}) {
  let {base} = options;

  // Check inline styles
  if (file.inline) {
    return normalizePath(`${document.virtualPath}.css`);
  }

  // Check remote
  if (file.remote) {
    return getRemoteStylesheetPath(file.urlObj, document.urlObj);
  }

  // Generate path relative to document if stylesheet is referenced relative
  //
  if (isRelative(file.path) && document.virtualPath) {
    return normalizePath(joinPath(dirname(document.virtualPath), file.path));
  }

  if (base && _resolve(file.path).includes(_resolve(base))) {
    base = _resolve(base);
    return normalizePath(`/${relative(_resolve(base), _resolve(file.path))}`);
  }

  // Try to compute path based on document link tags with same name
  const stylesheet = document.stylesheets
    .filter((href) => !Buffer.isBuffer(href))
    .find((href) => {
      const {pathname} = urlParse(href);
      const name = basename(pathname);
      return name === basename(file.path);
    });

  if (stylesheet && isRelative(stylesheet) && document.virtualPath) {
    return normalizePath(joinPath(dirname(document.virtualPath), stylesheet));
  }

  if (stylesheet && isRemote(stylesheet)) {
    return getRemoteStylesheetPath(urlParse(stylesheet), document.urlObj);
  }

  if (stylesheet) {
    return stylesheet;
  }

  // Try to find stylesheet path based on document link tags
  const [unsafestylesheet] = document.stylesheets
    .filter((href) => !Buffer.isBuffer(href))
    .sort((a) => (isRemote(a) ? 1 : -1));
  if (unsafestylesheet && isRelative(unsafestylesheet) && document.virtualPath) {
    return normalizePath(
      joinPath(dirname(document.virtualPath), joinPath(dirname(unsafestylesheet), basename(file.path)))
    );
  }

  if (unsafestylesheet && isRemote(unsafestylesheet)) {
    return getRemoteStylesheetPath(urlParse(unsafestylesheet), document.urlObj, basename(file.path));
  }

  if (stylesheet) {
    return stylesheet;
  }

  process.stderr.write(BASE_WARNING);
  if (document.virtualPath && file.path) {
    return normalizePath(joinPath(dirname(document.virtualPath), basename(file.path)));
  }

  return '';
}

/**
 * Get a list of possible asset paths
 * Guess this is rather expensive so this method should only be used if
 * there's no other possible way
 *
 * @param {Vinyl} document Html document
 * @param {string} file File path
 * @param {object} options Critical options
 * @param {boolean} strict Check for file existence
 * @returns {Promise<[string]>} List of asset paths
 */
export async function getAssetPaths(document, file, options = {}, strict = true) {
  const {base, rebase = {}, assetPaths = []} = options;
  const {history = [], url: docurl = '', urlObj} = document;
  const {from, to} = rebase;
  const {pathname: urlPath} = urlObj || {};
  const [docpath] = history;

  if (isVinyl(file)) {
    return [];
  }

  // Remove double dots in the middle
  const normalized = join(file);
  // Count temporaryDirectory hops
  const hops = normalized.split(sep).reduce((cnt, part) => (part === '..' ? cnt + 1 : cnt), 0);
  // Also findup first real dir path
  const [first] = normalized.split(sep).filter((p) => p && p !== '..'); // eslint-disable-line unicorn/prefer-array-find
  const mappedAssetPaths = base ? assetPaths.map((a) => joinPath(base, a)) : [];

  // Make a list of possible paths
  const paths = [
    ...new Set([
      base,
      base && isRelative(base) && join(process.cwd(), base),
      docurl,
      urlPath && urlResolve(urlObj.href, dirname(urlPath)),
      urlPath && !/\/$/.test(dirname(urlPath)) && urlResolve(urlObj.href, `${dirname(urlPath)}/`),
      docurl && urlResolve(docurl, file),
      docpath && dirname(docpath),
      ...assetPaths,
      ...mappedAssetPaths,
      to,
      from,
      base && docpath && join(base, dirname(docpath)),
      base && to && join(base, dirname(to)),
      base && from && join(base, dirname(from)),
      base && isRelative(file) && hops ? join(base, ...Array.from({length: hops}).fill('tmpdir'), file) : '',
      process.cwd(),
    ]),
  ];

  // Filter non-existent paths
  const filtered = await filterAsync(paths, (f) => {
    if (!f) {
      return false;
    }

    return !strict || fileExists(f, options);
  });

  // Findup first directory in search path and add to the list if available
  const all = await reduceAsync(filtered, [...new Set(filtered)], async (result, cwd) => {
    if (isRemote(cwd)) {
      return [...result, cwd];
    }

    const up = await findUp(first, {cwd, type: 'directory'});
    if (up) {
      const upDir = dirname(up);

      if (hops) {
        // Add additional directories based on dirHops
        const additional = relative(upDir, cwd).split(sep).slice(0, hops);
        return [...result, upDir, join(upDir, ...additional)];
      }

      return [...result, upDir];
    }

    return result;
  });

  debug(`(getAssetPaths) Search file "${file}" in:`, [...new Set(all)]);

  // Return uniquq result
  return [...new Set(all)];
}

/**
 * Create vinyl object from filepath
 * @param {object} src File descriptor either pass "filepath" or "html"
 * @param {object} options Critical options
 * @returns {Promise<Vinyl>} The vinyl object
 */
export async function vinylize(src, options = {}) {
  const {filepath, html} = src;
  const {rebase = {}} = options;
  const file = new Vinyl();
  file.cwd = '/';
  file.remote = false;
  file.inline = false;

  if (html) {
    const {to} = rebase;
    file.contents = Buffer.from(html);
    file.path = to || '';
    file.virtualPath = to || '';
  } else if (filepath && Buffer.isBuffer(filepath)) {
    file.path = '';
    file.virtualPath = '';
    file.contents = filepath;
    file.inline = true;
  } else if (filepath && isVinyl(filepath)) {
    return filepath;
  } else if (filepath && isRemote(filepath)) {
    file.remote = true;
    file.url = filepath;
    file.urlObj = urlParse(filepath);
    file.contents = await fetch(filepath, options);
    file.virtualPath = file.urlObj.pathname;
  } else if (filepath && existsSync(filepath)) {
    file.path = filepath;
    file.virtualPath = filepath;
    file.contents = await readFileAsync(filepath);
  } else {
    throw new FileNotFoundError(filepath);
  }

  return file;
}

/**
 * Get stylesheet file object
 * @param {Vinyl} document Document vinyl object
 * @param {string} filepath Path/Url to css file
 * @param {object} options Critical options
 * @returns {Promise<Vinyl>} Vinyl representation fo the stylesheet
 */
export async function getStylesheet(document, filepath, options = {}) {
  const {rebase = {}, css, strict, media} = options;
  const originalPath = filepath;

  const exists = await fileExists(filepath, options);

  if (!exists) {
    const searchPaths = await getAssetPaths(document, filepath, options);
    try {
      filepath = await resolve(filepath, searchPaths, options);
    } catch (error) {
      if (!isRemote(filepath) || strict) {
        throw error;
      }

      return new Vinyl();
    }
  }

  // Create absolute file paths for local files passed via css option
  // to prevent document relative stylesheet paths if they are not relative specified
<<<<<<< HEAD
  if (!Buffer.isBuffer(originalPath) && !isVinyl(filepath) && !isRemote(filepath) && checkCssOption(css)) {
    filepath = path.resolve(filepath);
=======
  if (!Buffer.isBuffer(originalPath) && !isVinyl(filepath) && !isRemote(filepath) && css) {
    filepath = _resolve(filepath);
>>>>>>> origin/feature/bump
  }

  const file = await vinylize({filepath}, options);
  if (media) {
    file.contents = Buffer.from(`@media ${media} { ${file.contents.toString()} }`);
  }

  // Restore original path for local files referenced from document and not from options
  if (!Buffer.isBuffer(originalPath) && !isRemote(originalPath) && !checkCssOption(css)) {
    file.path = originalPath;
  }

  // Get stylesheet path. Keeps stylesheet url if it differs from document url
  const stylepath = await getStylesheetPath(document, file, options);
  if (Buffer.isBuffer(originalPath)) {
    file.path = stylepath;
    file.virtualPath = stylepath;
  }

  debug('(getStylesheet) Virtual Stylesheet Path:', stylepath);

  // We can safely rebase assets if we have:
  // - a url to the stylesheet
  // - if rebase.from and rebase.to is specified
  // - a valid document path and a stylesheet path
  // - an absolute positioned stylesheet so we can make the images absolute
  // - and rebase is not disabled (#359)
  // First respect the user input
  if (rebase === false) {
    return file;
  }

  if (rebase.from && rebase.to) {
    file.contents = await rebaseAssets(file.contents, rebase.from, rebase.to, {
      method: 'rebase',
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });
  } else if (typeof rebase === 'function') {
    file.contents = await rebaseAssets(file.contents, stylepath, document.virtualPath, {
      method: rebase,
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });
    // Next rebase to the stylesheet url
  } else if (isRemote(rebase.to || stylepath)) {
    const from = rebase.from || stylepath;
    const to = rebase.to || stylepath;
    const method = (asset) => (isRemote(asset.originUrl) ? asset.originUrl : urlResolve(to, asset.originUrl));
    file.contents = await rebaseAssets(file.contents, from, to, {
      method,
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });

    // Use relative path to document (local)
  } else if (document.virtualPath) {
    file.contents = await rebaseAssets(file.contents, rebase.from || stylepath, rebase.to || document.virtualPath, {
      method: 'rebase',
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });
  } else if (document.remote) {
    const {pathname} = document.urlObj;
    file.contents = await rebaseAssets(file.contents, rebase.from || stylepath, rebase.to || pathname, {
      method: 'rebase',
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });

    // Make images absolute if we have an absolute positioned stylesheet
  } else if (isAbsolute(stylepath)) {
    file.contents = await rebaseAssets(file.contents, rebase.from || stylepath, rebase.to || '/index.html', {
      method: (asset) => normalizePath(asset.absolutePath),
      strict: options.strict,
      inlined: Buffer.isBuffer(originalPath),
    });
  } else {
    warn(`Not rebasing assets for ${originalPath}. Use "rebase" option`);
  }

  debug('(getStylesheet) Result:', file);

  return file;
}

/**
 * Get css for document
 * @param {Vinyl} document Vinyl representation of HTML document
 * @param {object} options Critical options
 * @returns {Promise<string>} Css string unoptimized, Multiple stylesheets are concatenated with EOL
 */
async function getCss(document, options = {}) {
  const {css} = options;
  let stylesheets = [];

  if (checkCssOption(css)) {
    const files = await glob(css, options);
    stylesheets = await mapAsync(files, (file) => getStylesheet(document, file, options));
    debug('(getCss) css option set', files, stylesheets);
  } else {
    stylesheets = await mapAsync(document.stylesheets, (file, index) => {
      const media = (document.stylesheetsMedia || [])[index];
      return getStylesheet(document, file, {...options, media});
    });
    debug('(getCss) extract from document', document.stylesheets, stylesheets);
  }

  return stylesheets
    .filter((stylesheet) => !stylesheet.isNull())
    .map((stylesheet) => stylesheet.contents.toString())
    .join(EOL);
}

/**
 * We need to make sure the html file is available alongside the relative css files
 * as they are required by penthouse/puppeteer to render the html correctly
 * @see https://github.com/pocketjoso/penthouse/issues/280
 *
 * @param {Vinyl} document Vinyl representation of HTML document
 * @returns {Promise<string>} File url to html file for use in penthouse
 */
async function preparePenthouseData(document) {
  const tmp = [];
  const stylesheets = document.stylesheets || [];
  const [stylesheet, ...canBeEmpty] = stylesheets
    .filter((file) => isRelative(file))
    .map((file) => file.replace(/\?.*$/, ''));

  // Make sure we go as deep inside the temp folder as required by relative stylesheet hrefs
  const subfolders = [stylesheet, ...canBeEmpty]
    .reduce((res, href) => {
      const match = /^(\.\.\/)+/.exec(href || '');
      return match && match[0].length > res.length ? match[0] : res;
    }, './')
    .replace(/\.\.\//g, 'sub/');
<<<<<<< HEAD
  const dir = path.join(temporaryDirectory(), subfolders);
  const filename = path.basename(temporaryFile({extension: 'html'}));
  const file = path.join(dir, filename);
=======
  const dir = join(temporaryDirectory(), subfolders);
  const filename = basename(temporaryFile({extension: 'html'}));
  const file = join(dir, filename);
>>>>>>> origin/feature/bump

  const htmlContent = document.contents.toString();
  // Inject all styles to make sure we have everything in place
  // because puppeteer doesn't seem to fetch protocol relative links
  // when served from file://
  const injected = htmlContent.replace(/(<head(?:\s[^>]*)?>)/gi, `$1<style>${document.css.toString()}</style>`);
  // Write html to temp file
  await outputFileAsync(file, injected);

  tmp.push(file);

  // Write styles to first stylesheet
  if (stylesheet) {
    const filename = join(dir, stylesheet);
    tmp.push(filename);
    await outputFileAsync(filename, document.css);
  }

  // Write empty string to rest of the linked stylesheets
  await forEachAsync(canBeEmpty, (dummy) => {
    const filename = join(dir, dummy);
    tmp.push(filename);
    outputFileAsync(filename, '');
  });

  return [getFileUri(file), getCleanup(tmp)];
}

/**
 * Get document file object
 * @param {string} filepath Path/Url to html file
 * @param {object} options Critical options
 * @returns {Promise<Vinyl>} Vinyl representation of HTML document
 */
export async function getDocument(filepath, options = {}) {
  const {rebase = {}, base} = options;

  if (!isVinyl(filepath) && !isRemote(filepath) && !existsSync(filepath) && base) {
    filepath = joinPath(base, filepath);
  }

  const document = await vinylize({filepath}, options);

<<<<<<< HEAD
  document.stylesheets = await getStylesheetHrefs(document, options);
  document.stylesheetsMedia = await getStylesheetsMedia(document, options);
=======
  document.stylesheets = getStylesheetHrefs(document);
  document.stylesheetsMedia = getStylesheetsMedia(document);
>>>>>>> origin/feature/bump
  document.virtualPath = rebase.to || (await getDocumentPath(document, options));

  document.cwd = base || process.cwd();
  if (!base && document.path) {
    document.cwd = document.path.replace(document.virtualPath, '');
  }

  debug('(getDocument) Result: ', {
    path: document.path,
    url: document.url,
    remote: Boolean(document.remote),
    virtualPath: document.virtualPath,
    stylesheets: document.stylesheets,
    cwd: document.cwd,
  });

  document.css = await getCss(document, options);

  const [url, cleanup] = await preparePenthouseData(document);
  document.url = url;
  document.cleanup = cleanup;

  return document;
}

/**
 * Get document file object from raw html source
 * @param {string} html HTML source
 * @param {object} options Critical options
 * @returns {Promise<*>} Vinyl representation of HTML document
 */
export async function getDocumentFromSource(html, options = {}) {
  const {rebase = {}, base} = options;
  const document = await vinylize({html}, options);

  document.stylesheets = getStylesheetHrefs(document);
  document.stylesheetsMedia = getStylesheetsMedia(document);
  document.virtualPath = rebase.to || (await getDocumentPath(document, options));
  document.cwd = base || process.cwd();

  debug('(getDocumentFromSource) Result: ', {
    path: document.path,
    url: document.url,
    remote: Boolean(document.remote),
    virtualPath: document.virtualPath,
    stylesheets: document.stylesheets,
    cwd: document.cwd,
  });

  document.css = await getCss(document, options);

  const [url, cleanup] = await preparePenthouseData(document);
  document.url = url;
  document.cleanup = cleanup;

  return document;
}
