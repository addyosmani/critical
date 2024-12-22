import path from 'node:path';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import through2 from 'through2';
import PluginError from 'plugin-error';
import replaceExtension from 'replace-ext';
import {create} from './src/core.js';
import {outputFileAsync} from './src/file.js';
import {getOptions} from './src/config.js';

/**
 * Critical path CSS generation
 * @param  {object} params Options
 * @param  {function} cb Callback
 * @return {Promise<object>} Result object with html, css & optional extracted original css
 */
export async function generate(params, cb) {
  try {
    const options = await getOptions(params);
    const {target = {}, base = process.cwd()} = options;
    const result = await create(options);
    // Store generated css
    if (target.css) {
      await outputFileAsync(path.resolve(base, target.css), result.css);
    }

    // Store generated html
    if (target.html) {
      await outputFileAsync(path.resolve(base, target.html), result.html);
    }

    // Store extracted css
    if (target.uncritical) {
      await outputFileAsync(path.resolve(base, target.uncritical), result.uncritical);
    }

    if (typeof cb === 'function') {
      cb(null, result);
      return;
    }

    return result;
  } catch (error) {
    if (typeof cb === 'function') {
      cb(error);
      return;
    }

    throw error;
  }
}

/**
 * Streams wrapper for critical
 *
 * @param {object} params Critical options
 * @returns {stream} Gulp stream
 */
export function stream(params) {
  // Return stream
  return through2.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }

    if (file.isStream()) {
      return this.emit('error', new PluginError('critical', 'Streaming not supported'));
    }

    Promise.resolve()
      .then(() => generate({...params, src: file}))
      .then(({css, html}) => {
        // Rename file if not inlined
        if (params.inline) {
          file.contents = Buffer.from(html);
        } else {
          file.path = replaceExtension(file.path, '.css');
          file.contents = Buffer.from(css);
        }

        cb(null, file);
      })
      .catch((error) => cb(new PluginError('critical', error.message)));
  });
}

generate.stream = stream;
