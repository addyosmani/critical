#!/usr/bin/env node

'use strict';

const os = require('os');
const chalk = require('chalk');
const meow = require('meow');
const groupArgs = require('group-args');
const indentString = require('indent-string');
const stdin = require('get-stdin');
const reduce = require('lodash/reduce');
const isString = require('lodash/isString');
const isObject = require('lodash/isObject');
const escapeRegExp = require('lodash/escapeRegExp');
const {validate} = require('./src/config');
const critical = require('.');

const help = `
Usage: critical <input> [<option>]

Options:
  -b, --base              Your base directory
  -c, --css               Your CSS Files (optional)
  -w, --width             Viewport width
  -h, --height            Viewport height
  -i, --inline            Generate the HTML with inlined critical-path CSS
  -e, --extract           Extract inlined styles from referenced stylesheets

  --inlineImages          Inline images
  --ignore                RegExp, @type or selector to ignore
  --ignore-[OPTION]       Pass options to postcss-discard. See https://goo.gl/HGo5YV
  --include               RegExp, @type or selector to include
  --include-[OPTION]      Pass options to inline-critical. See https://goo.gl/w6SHJM
  --assetPaths            Directories/Urls where the inliner should start looking for assets.
  --user                  RFC2617 basic authorization user
  --pass                  RFC2617 basic authorization password
  --penthouse-[OPTION]    Pass options to penthouse. See https://goo.gl/PQ5HLL
  --ua, --userAgent       User agent to use when fetching remote src
`;

const minimistOpts = {
  flags: {
    base: {
      type: 'string',
      alias: 'b',
    },
    css: {
      type: 'string',
      alias: 'c',
    },
    width: {
      alias: 'w',
    },
    height: {
      alias: 'h',
    },
    inline: {
      type: 'boolean',
      alias: 'i',
    },
    extract: {
      type: 'boolean',
      alias: 'e',
      default: false,
    },
    inlineImages: {
      type: 'boolean',
    },
    ignore: {
      type: 'string',
    },
    user: {
      type: 'string',
    },
    pass: {
      type: 'string',
    },
    userAgent: {
      type: 'string',
      alias: 'ua',
    },
  },
};

const cli = meow(help, minimistOpts);

const groupKeys = ['ignore', 'inline', 'penthouse', 'target', 'request'];
// Group args for inline-critical and penthouse
const grouped = {
  ...cli.flags,
  ...groupArgs(
    groupKeys,
    {
      delimiter: '-',
    },
    minimistOpts
  ),
};

/**
 * Check if key is an alias
 * @param {string} key Key to check
 * @returns {boolean} True for alias
 */
const isAlias = key => {
  if (isString(key) && key.length > 1) {
    return false;
  }

  const aliases = Object.keys(minimistOpts.flags)
    .filter(k => minimistOpts.flags[k].alias)
    .map(k => minimistOpts.flags[k].alias);

  return aliases.includes(key);
};

/**
 * Check if value is an empty object
 * @param {mixed} val Value to check
 * @returns {boolean} Whether or not this is an empty object
 */
const isEmptyObj = val => isObject(val) && Object.keys(val).length === 0;

/**
 * Check if value is transformed to {default: val}
 * @param {mixed} val Value to check
 * @returns {boolean} True if it's been converted to {default: value}
 */
const isGroupArgsDefault = val => isObject(val) && Object.keys(val).length === 1 && val.default;

/**
 * Return regex if value is a string like this: '/.../g'
 * @param {mixed} val Value to process
 * @returns {mixed} Mapped values
 */
const mapRegExpStr = val => {
  if (isString(val)) {
    const match = val.match(/^\/(.*)\/([igmy]+)?$/);
    return (match && new RegExp(escapeRegExp(match[1]), match[2])) || val;
  }

  if (Array.isArray(val)) {
    return val.map(v => mapRegExpStr(v));
  }

  return val;
};

const normalizedFlags = reduce(
  grouped,
  (res, val, key) => {
    // Cleanup groupArgs mess ;)
    if (groupKeys.includes(key)) {
      // An empty object means param without value, just true
      if (isEmptyObj(val)) {
        val = true;
      } else if (isGroupArgsDefault(val)) {
        val = val.default;
      }
    }

    // Cleanup camelized group keys
    if (groupKeys.find(k => key.includes(k)) && !validate(key, val)) {
      return res;
    }

    if (!isAlias(key)) {
      res[key] = mapRegExpStr(val);
    }

    return res;
  },
  {}
);

function showError(err) {
  process.stderr.write(indentString(chalk.red('Error: ') + err.message || err, 3));
  process.stderr.write(os.EOL);
  process.stderr.write(indentString(help, 3));
  process.exit(1);
}

function run(data) {
  const {_: inputs = [], css, ...opts} = {...normalizedFlags};

  // Detect css globbing
  const cssBegin = process.argv.findIndex(el => ['--css', '-c'].includes(el));
  const cssEnd = process.argv.findIndex((el, index) => index > cssBegin && el.startsWith('-'));
  const cssCheck = cssBegin >= 0 ? process.argv.slice(cssBegin, cssEnd > 0 ? cssEnd : undefined) : [];
  const additionalCss = inputs.filter(file => cssCheck.includes(file));
  // Just take the first html input as we don't support multiple html sources for
  const [input] = inputs.filter(file => !additionalCss.includes(file));

  if (Array.isArray(css)) {
    opts.css = [...css, ...additionalCss].filter(file => file);
  } else if (css || additionalCss.length > 0) {
    opts.css = [css, ...additionalCss].filter(file => file);
  }

  if (data) {
    opts.html = data;
  } else {
    opts.src = input;
  }

  try {
    critical.generate(opts, (error, val) => {
      if (error) {
        showError(error);
      } else if (opts.inline) {
        process.stdout.write(val.html, process.exit);
      } else if (opts.extract) {
        process.stdout.write(val.uncritical, process.exit);
      } else {
        process.stdout.write(val.css, process.exit);
      }
    });
  } catch (error) {
    showError(error);
  }
}

if (cli.input[0]) {
  run();
} else {
  // Get stdin
  stdin().then(run); /* eslint-disable-line promise/prefer-await-to-then */
}
