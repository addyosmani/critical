#!/usr/bin/env node
'use strict';
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const meow = require('meow');
const groupArgs = require('group-args');
const indentString = require('indent-string');
const stdin = require('get-stdin');
const assign = require('lodash/assign');
const reduce = require('lodash/reduce');
const isString = require('lodash/isString');
const isRegExp = require('lodash/isRegExp');
const map = require('lodash/map');
const escapeRegExp = require('lodash/escapeRegExp');

const file = require('./lib/file-helper');
const critical = require('./');

let ok;

const help = [
    'Usage: critical <input> [<option>]',
    '',
    'Options:',
    '   -b, --base              Your base directory',
    '   -c, --css               Your CSS Files (optional)',
    '   -w, --width             Viewport width',
    '   -h, --height            Viewport height',
    '   -m, --minify            Minify critical-path CSS when inlining',
    '   -i, --inline            Generate the HTML with inlined critical-path CSS',
    '   -e, --extract           Extract inlined styles from referenced stylesheets',
    '   -p, --pathPrefix        Path to prepend CSS assets with (defaults to /) ',
    '   -f, --folder            HTML Subfolder (default: \'\')',
    '   --ii, --inlineImages    Inline images',
    '   --ignore                RegExp, @type or selector to ignore',
    '   --include               RegExp, @type or selector to include',
    '   --maxFileSize           Sets a max file size (in bytes) for base64 inlined images',
    '   --assetPaths            Directories/Urls where the inliner should start looking for assets.',
    '   --timeout               Sets the maximum timeout (in milliseconds) for the operation (defaults to 30000 ms).'
];

const minimistOpts = {
    alias: {
        b: 'base',
        c: 'css',
        w: 'width',
        h: 'height',
        f: 'folder',
        i: 'inline',
        I: 'ignore',
        m: 'minify',
        e: 'extract',
        p: 'pathPrefix',
        ii: 'inlineImages'
    }
};

const cli = meow({help}, minimistOpts);

// Group args for inline-critical and penthouse
cli.flags = groupArgs(['inline', 'penthouse'], {
    delimiter: '-'
}, minimistOpts);

// Cleanup cli flags and assert cammelcase keeps camelcase
cli.flags = reduce(cli.flags, (res, val, key) => {
    if (key.length <= 1) {
        return res;
    }

    switch (key) {
        case 'pathprefix':
            res.pathPrefix = val;
            break;
        case 'inlineimages':
            res.inlineImages = val;
            break;
        case 'maxfilesize':
            res.maxFileSize = val;
            break;
        case 'timeout':
            res.timeout = val;
            break;
        case 'assetpaths':
        case 'assetPaths':
            if (isString(val)) {
                val = [val];
            }
            res.assetPaths = val;
            break;
        case 'include':
        case 'ignore':
            if (isString(val) || isRegExp(val)) {
                val = [val];
            }
            res[key] = map(val || [], entry => {
                // Check regex
                const match = entry.match(/^\/(.*)\/([igmy]+)?$/);

                if (match) {
                    return new RegExp(escapeRegExp(match[1]), match[2]);
                }
                return entry;
            });
            break;
        default:
            res[key] = val;
            break;
    }

    return res;
}, {});

function error(err) {
    process.stderr.write(indentString((chalk.red('Error: ') + err.message || err), 3));
    process.stderr.write(os.EOL);
    process.stderr.write(indentString(help.join(os.EOL), 3));
    process.exit(1);
}

function run(data) {
    const opts = assign({base: process.cwd()}, cli.flags);
    ok = true;

    if (data) {
        opts.html = data;
    } else {
        opts.src = cli.input[0];
        if (opts.src && !file.isExternal(opts.src)) {
            opts.src = path.resolve(cli.input[0]);
        }
    }

    try {
        critical.generate(opts, (err, val) => {
            if (err) {
                error(err);
            } else {
                process.stdout.write(val, process.exit);
            }
        });
    } catch (err) {
        error(err);
    }
}

if (cli.input[0]) {
    run();
} else {
    // Get stdin
    stdin().then(run);
    setTimeout(() => {
        if (ok) {
            return;
        }
        run();
    }, 100);
}
