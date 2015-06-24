#!/usr/bin/env node
'use strict';
var os = require('os');
var path = require('path');
var meow = require('meow');
var objectAssign = require('object-assign');
var indentString = require('indent-string');
var stdin = require('get-stdin');
var _ = require('lodash');
var critical = require('./');
var ok;

var help = [
    'Usage: critical <input> [<option>]',
    '',
    'Options:',
    '   -b, --base              Your base directory',
    '   -c, --css               Your CSS Files (optional)',
    '   -w, --width             Viewport width',
    '   -h, --height            Viewport height',
    '   -m, --minify            Minify critical-path CSS when inlining',
    '   -i, --inline            Generate the HTML with inlined critical-path CSS',
    '   -I, --ignore            RegExp, @type or selector to ignore',
    '   -e, --extract           Extract inlined styles from referenced stylesheets',
    '   -p, --pathPrefix        Path to prepend CSS assets with (defaults to /) ',
    '   ----------------------------------------------------------------------.',
    '   Deprecated - use "--inline" to retrieve the modified HTML',
    '   critical source.html --inline > dest.html',
    '   -----------------------------------------------------------------------',
    '   -H, --htmlTarget        Target for final HTML output',
    '   -S, --styleTarget       Target for generated critical-path CSS (which we inline)'
];

var cli = meow({
    help: help
}, {
    alias: {
        b: 'base',
        c: 'css',
        w: 'width',
        h: 'height',
        H: 'htmlTarget',
        i: 'inline',
        I: 'ignore',
        S: 'styleTarget',
        m: 'minify',
        e: 'extract',
        p: 'pathPrefix'
    }
});

// cleanup cli flags and assert cammelcase keeps camelcase
cli.flags = _.reduce(cli.flags, function (res, val, key) {
    if (key.length <= 1) {
        return res;
    }

    switch (key) {
        case 'htmltarget':
            res.htmlTarget = val;
            break;
        case 'styletarget':
            res.styleTarget = val;
            break;
        case 'pathprefix':
            res.pathPrefix = val;
            break;
        case 'inline':
            res.inline = val && val !== 'false' || typeof val === 'undefined';
            break;
        case 'ignore':
            if (_.isString(val) || _.isRegExp(val)) {
                val = [val];
            }
            res.ignore = _.map(val || [], function(ignore) {
                // check regex
                var match = ignore.match(/^\/(.*)\/([igmy]+)?$/);

                if (match) {
                    return new RegExp(_.escapeRegExp(match[1]),match[2]);
                }
                return ignore;
            });
            break;
        default:
            res[key] = val;
            break;
    }

    return res;
}, {});

function error(err) {
    process.stderr.write(indentString(err.message || err, '   Error: '));
    process.stderr.write(os.EOL);
    process.stderr.write(indentString(help.join(os.EOL), '   '));
    process.exit(1);
}

function run(data) {
    var opts = objectAssign({base: process.cwd()}, cli.flags);
    var command = opts.htmlTarget || opts.inline ? 'generateInline' : 'generate';

    if (command === 'generate') {
        opts.dest = opts.styleTarget || '';
    }

    ok = true;

    if (data) {
        opts.html = data;
    } else {
        opts.src = cli.input[0] ? path.resolve(cli.input[0]) : '';
    }

    try {
        critical[command](opts, function (err, val) {
            if (err) {
                error(err);
            } else {
                process.stdout.write(val);
            }
        });
    } catch (err) {
        error(err);
    }
}


if (cli.input[0]) {
    run();
} else {
    stdin(run);
    setTimeout(function () {
        if (ok) {
            return;
        }
        cli.showHelp();
    }, 100);
}

