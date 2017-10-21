'use strict';
const path = require('path');
const fs = require('fs-extra');
const assign = require('lodash/assign');
const defaults = require('lodash/defaults');
const isFunction = require('lodash/isFunction');
const isObject = require('lodash/isObject');
const intersection = require('lodash/intersection');
const keys = require('lodash/keys');

const chalk = require('chalk');
const sourceInliner = require('inline-critical');
const Bluebird = require('bluebird');
const through2 = require('through2');
const PluginError = require('gulp-util').PluginError;
const replaceExtension = require('gulp-util').replaceExtension;

const core = require('./lib/core');
const file = require('./lib/file-helper');

Bluebird.promisifyAll(fs);

/**
 * Normalize options
 *
 * @param opts
 */
function prepareOptions(opts) {
    if (!opts) {
        opts = {};
    }

    const options = defaults(opts, {
        base: file.guessBasePath(opts),
        dimensions: [{
            height: opts.height || 900,
            width: opts.width || 1300
        }]
    });

    // Set dest relative to base if isn't specivied absolute
    if (options.dest && !path.isAbsolute(options.dest)) {
        options.dest = path.join(options.base, options.dest);
    }

    // Set dest relative to base if isn't specivied absolute
    if (options.destFolder && !path.isAbsolute(options.destFolder)) {
        options.destFolder = path.join(options.base, options.destFolder);
    }

    // Set options for inline-critical
    options.inline = Boolean(options.inline) && assign({
        minify: opts.minify || false,
        extract: opts.extract || false,
        basePath: opts.base || process.cwd()
    }, (isObject(options.inline) && options.inline) || {});

    // Set penthouse options
    options.penthouse = assign({}, {
        forceInclude: opts.include || [],
        timeout: opts.timeout || 30000,
        maxEmbeddedBase64Length: opts.maxImageFileSize || 10240
    }, options.penthouse || {});

    // Show overwrite warning if penthouse params url, css, witdh or height are present
    const checkOpts = intersection(keys(options.penthouse), ['url', 'css', 'width', 'height']);
    if (checkOpts.length > 0) {
        console.warn(chalk.yellow('Detected presence of penthouse options:'), checkOpts.join(', '));
        console.warn(chalk.yellow('These options will be overwritten by critical during the process.'));
    }

    return options;
}

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise}|undefined
 */
exports.generate = function (opts, cb) {
    opts = prepareOptions(opts);

    // Generate critical css
    let corePromise = core.generate(opts);

    // Store generated css
    if (opts.styleTarget) {
        corePromise.then(output => {
            const file = path.resolve(opts.styleTarget);
            const dir = path.dirname(file);
            return fs.ensureDirAsync(dir).then(() => {
                return fs.writeFileAsync(path.resolve(opts.styleTarget), output);
            });
        });
    }

    // Inline
    if (opts.inline) {
        corePromise = Bluebird.props({
            file: file.getVinylPromise(opts),
            css: corePromise
        }).then(result => {
            return sourceInliner(result.file.contents.toString(), result.css, opts.inline);
        });
    }

    // Save to file
    if (opts.dest) {
        corePromise = corePromise.then(output => {
            const file = path.resolve(opts.dest);
            const dir = path.dirname(file);
            return fs.ensureDirAsync(dir).then(() => {
                return fs.writeFileAsync(path.resolve(opts.dest), output);
            }).then(() => {
                return output;
            });
        });
    }

    // Return promise if callback is not defined
    if (isFunction(cb)) {
        corePromise.catch(err => {
            cb(err);
            throw new Bluebird.CancellationError();
        }).then(output => {
            cb(null, output.toString());
        }).catch(Bluebird.CancellationError, () => {
        }).done();
    } else {
        return corePromise;
    }
};

/**
 * Deprecated has been removed
 */
exports.generateInline = function () {
    throw new Error('"generateInline" has been removed. Use "generate" with the inline option instead. https://goo.gl/7VbE4b');
};

/**
 * Deprecated has been removed
 */
exports.inline = function () {
    throw new Error('"inline" has been removed. Consider using "inline-critical" instead. https://goo.gl/MmTrUZ');
};

/**
 * Streams wrapper for critical
 *
 * @param {object} opts
 * @returns {*}
 */
exports.stream = function (opts) {
    // Return stream
    return through2.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }

        if (file.isStream()) {
            return this.emit('error', new PluginError('critical', 'Streaming not supported'));
        }

        const options = assign(opts || {}, {
            src: file
        });

        exports.generate(options, (err, data) => {
            if (err) {
                return cb(new PluginError('critical', err.message));
            }

            // Rename file if not inlined
            if (!opts.inline) {
                file.path = replaceExtension(file.path, '.css');
            }

            file.contents = Buffer.from(data);
            cb(err, file);
        });
    });
};
