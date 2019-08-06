'use strict';

const chalk = require('chalk');
const {stripIndents, stripIndent} = require('common-tags');

class FileNotFoundError extends Error {
  constructor(file = '', paths = [], ...params) {
    const message = chalk.red(stripIndent`
      Error: File not found: ${file}
             Current working directory: ${process.cwd()}
             Searched in: ${paths.length > 0 ? paths.join(', ') : '-'}
    `);

    super([message, ...params]);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }

    this.file = file;
  }
}

class NoCssError extends Error {
  constructor(...params) {
    const message = chalk.red(stripIndents`
      Error: No stylesheets found in document and no css was specified in the options
    `);

    super([message, ...params]);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }
  }
}

class ConfigError extends Error {
  constructor(msg, ...params) {
    const message = chalk.red(stripIndents`
      ConfigError: ${msg}
    `);
    // Const message = chalk.red(stripIndents`Error - ${msg}`);
    //
    super([message, ...params]);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }
  }
}

module.exports = {
  FileNotFoundError,
  NoCssError,
  ConfigError,
};
