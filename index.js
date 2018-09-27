/* eslint promise/prefer-await-to-then:0 */
const path = require('path');
const fs = require('fs-extra');
const through2 = require('through2');
const PluginError = require('plugin-error');
const replaceExtension = require('replace-ext');
const {create} = require('./src/core');
const {getOptions} = require('./src/config');
//
// process.on('unhandledRejection', reason => {
//   console.log('Unhandled Rejection at:', reason.stack || reason);
// });

/**
 * Critical path CSS generation
 * @param  {object} params Options
 * @param  {function} cb Callback
 * @return {Promise<object>} Result object with html, css & optional extracted original css
 */
async function generate(params, cb) {
  try {
    const options = getOptions(params);
    const {target = {}} = options;

    const {css, html} = await create(options);

    // Store generated css
    if (target.css) {
      await fs.outputFile(path.resolve(target.css), css);
    }

    // Store generated html
    if (target.html) {
      await fs.outputFile(path.resolve(target.html), html);
    }

    if (typeof cb === 'function') {
      cb(null, {css, html});
      return;
    }

    return {css, html};
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
function stream(params) {
  // Return stream
  return through2.obj(function(file, enc, cb) {
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
      .catch(error => cb(new PluginError('critical', error.message)));
  });
}

generate.stream = stream;

module.exports = {
  generate,
  stream,
};
