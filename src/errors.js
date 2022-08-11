import process from 'node:process';
import pico from 'picocolors';
import {stripIndents, stripIndent} from 'common-tags';

export class FileNotFoundError extends Error {
  constructor(file = '', paths = [], ...params) {
    const message = pico.red(stripIndent`
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

export class NoCssError extends Error {
  constructor(...params) {
    const message = pico.red(stripIndents`
      Error: No stylesheets found in document and no css was specified in the options
    `);

    super([message, ...params]);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }
  }
}

export class ConfigError extends Error {
  constructor(msg, ...params) {
    const message = pico.red(stripIndents`
      ConfigError: ${msg}
    `);

    super([message, ...params]);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }
  }
}
