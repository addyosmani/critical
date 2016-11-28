'use strict';
var path = require('path');
var fs = require('fs-extra');
var _ = require('lodash');
var chalk = require('chalk');
var sourceInliner = require('inline-critical');
var Bluebird = require('bluebird');
var through2 = require('through2');
var PluginError = require('gulp-util').PluginError;
var replaceExtension = require('gulp-util').replaceExtension;

var core = require('./lib/core');
var file = require('./lib/file-helper');
var inliner = require('./lib/inline-styles');

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

    var options = _.defaults(opts, {
        base: file.guessBasePath(opts),
        dimensions: [{
            height: opts.height || 900,
            width: opts.width || 1300
        }]
    });

    // set dest relative to base if isn't specivied absolute
    if (options.dest && !path.isAbsolute(options.dest)) {
        options.dest = path.join(options.base, options.dest);
    }

    // set dest relative to base if isn't specivied absolute
    if (options.destFolder && !path.isAbsolute(options.destFolder)) {
        options.destFolder = path.join(options.base, options.destFolder);
    }

    // set options for inline-critical
    options.inline = Boolean(options.inline) && _.assign({
        minify: opts.minify || false,
        extract: opts.extract || false,
        basePath: opts.base || process.cwd()
    }, (_.isObject(options.inline) && options.inline) || {});

    // set penthouse options
    options.penthouse = _.assign({}, {
        forceInclude: opts.include || [],
        timeout: opts.timeout || 30000,
        maxEmbeddedBase64Length: opts.maxImageFileSize || 10240
    }, options.penthouse || {});

    // show overwrite warning if penthouse params url, css, witdh or height are present
    var checkOpts = _.intersection(_.keys(options.penthouse), ['url', 'css', 'width', 'height']);
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

    // generate critical css
    var corePromise = core.generate(opts);

    // @deprecated
    // should be removed in next major release
    if (opts.styleTarget) {
        corePromise.then(function (output) {
            var file = path.resolve(opts.styleTarget);
            var dir = path.dirname(file);
            return fs.ensureDirAsync(dir).then(function () {
                return fs.writeFileAsync(path.resolve(opts.styleTarget), output);
            });
        });
    }

    // inline
    if (opts.inline) {
        corePromise = Bluebird.props({
            file: file.getVinylPromise(opts),
            css: corePromise
        }).then(function (result) {
            return sourceInliner(result.file.contents.toString(), result.css, opts.inline);
        });
    }

    // save to file
    if (opts.dest) {
        corePromise = corePromise.then(function (output) {
            var file = path.resolve(opts.dest);
            var dir = path.dirname(file);
            return fs.ensureDirAsync(dir).then(function () {
                return fs.writeFileAsync(path.resolve(opts.dest), output);
            }).then(function () {
                return output;
            });
        });
    }

    // return promise if callback is not defined
    if (_.isFunction(cb)) {
        corePromise.catch(function (err) {
            cb(err);
            throw new Bluebird.CancellationError();
        }).then(function (output) {
            cb(null, output.toString());
        }).catch(Bluebird.CancellationError, function () {
        }).done();
    } else {
        return corePromise;
    }
};

/**
 * deprecated will be removed in the next version
 * @param opts
 * @param cb
 * @returns {Promise}|undefined
 */
exports.generateInline = function (opts, cb) {
    if (!opts.inline) {
        opts.inline = true;
    }
    if (opts.htmlTarget) {
        opts.dest = opts.htmlTarget;
    } else if (opts.styleTarget) {
        // return error
    }

    return exports.generate(opts, cb);
};

/**
 * Critical path CSS inlining
 * @param  {object} opts Options
 * @param  {function} cb Callback
 * @accepts src, base, dest
 * @deprecated
 */
exports.inline = function (opts, cb) {
    opts = opts || {};
    cb = cb || function () {};

    if (!opts.src || !opts.base) {
        throw new Error('A valid source and base path are required.');
    }

    // Inline the critical path CSS
    fs.readFile(path.join(opts.base, opts.src), function (err, data) {
        if (err) {
            cb(err);
            return;
        }

        var out = inliner(data, opts);

        if (opts.dest) {
            // Write HTML with inlined CSS to dest
            fs.writeFile(path.resolve(opts.dest), out, function (err) {
                if (err) {
                    cb(err);
                    return;
                }

                cb(null, out.toString());
            });
        } else {
            cb(null, out.toString());
        }
    });
};

/**
 * Streams wrapper for critical
 *
 * @param {object} opts
 * @returns {*}
 */
exports.stream = function (opts) {
    // return stream
    return through2.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }

        if (file.isStream()) {
            return this.emit('error', new PluginError('critical', 'Streaming not supported'));
        }

        var options = _.assign(opts || {}, {
            src: file
        });

        exports.generate(options, function (err, data) {
            if (err) {
                return cb(new PluginError('critical', err.message));
            }

            // rename file if not inlined
            if (!opts.inline) {
                file.path = replaceExtension(file.path, '.css');
            }

            file.contents = new Buffer(data);
            cb(err, file);
        });
    });
};
