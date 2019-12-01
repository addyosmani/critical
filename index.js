'use strict';

const path = require('path');
const fs = require('fs-extra');
const {assign, defaults, isFunction, isObject, intersection, keys} = require('lodash');

const chalk = require('chalk');
const sourceInliner = require('inline-critical');
const Bluebird = require('bluebird');
const through2 = require('through2');
const PluginError = require('plugin-error');
const replaceExtension = require('replace-ext');

const {cleanup} = require('./lib/gc');
const core = require('./lib/core');
const file = require('./lib/file-helper');

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

    if (!options.inline && options.extract) {
        console.error(chalk.red('The extract option requires inline:true'));
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

    // Order dimensions
    options.dimensions = options.dimensions.slice().sort((a, b) => (a.width || 0) - (b.width || 0));

    return options;
}

/**
 * Critical path CSS generation
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, width, height, dimensions, dest
 * @return {Promise}|undefined
 */
exports.generate = (opts, cb) => {
    opts = prepareOptions(opts);

    // Generate critical css
    let corePromise = core.generate(opts);

    // Store generated css
    if (opts.styleTarget) {
        corePromise = corePromise.then(output => fs.outputFile(path.resolve(opts.styleTarget), output).then(() => output));
    }

    // Inline
    if (opts.inline) {
        corePromise = Promise.all([file.getVinylPromise(opts), corePromise])
            .then(([file, css]) => {
                if (css) {
                    return sourceInliner(file.contents.toString(), css, opts.inline);
                }

                return file.contents.toString();
            });
    }

    // Save to file
    if (opts.dest) {
        corePromise = corePromise.then(output => fs.outputFile(path.resolve(opts.dest), output).then(() => output));
    }

    // Return promise if callback is not defined
    if (isFunction(cb)) {
        corePromise.catch(error => { // eslint-disable-line promise/valid-params
            cleanup();
            cb(error);
            throw new Bluebird.CancellationError();
        }).then(output => {
            cleanup();
            cb(null, output.toString());
        }).catch(Bluebird.CancellationError, () => {
            console.log('Canceled due to an error');
            /* Everything already done */
        });
    } else {
        return corePromise.then(output => {
            cleanup();
            return output;
        });
    }
};

/**
 * Deprecated has been removed
 */
exports.generateInline = () => {
    throw new Error('"generateInline" has been removed. Use "generate" with the inline option instead. https://goo.gl/7VbE4b');
};

/**
 * Deprecated has been removed
 */
exports.inline = () => {
    throw new Error('"inline" has been removed. Consider using "inline-critical" instead. https://goo.gl/MmTrUZ');
};

/**
 * Streams wrapper for critical
 *
 * @param {object} opts
 * @returns {*}
 */
exports.stream = opts => {
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
