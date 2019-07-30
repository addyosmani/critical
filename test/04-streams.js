/*
 * Unit tests for Critical.
 */
/* eslint-env node, mocha */
'use strict';
const path = require('path');
const fs = require('fs');
const {assert} = require('chai');
const vinylStream = require('vinyl-source-stream');
const streamAssert = require('stream-assert');
const Vinyl = require('vinyl');
const array = require('stream-array');
const nn = require('normalize-newline');

const {read} = require('./helper/testhelper');
const critical = require('..');

process.chdir(path.resolve(__dirname));

/**
 * Get vinyl file object
 *
 * @returns {*|StreamArray|exports}
 */
function getVinyl(...args) {
    function create(filepath) {
        const file = path.join(__dirname, 'fixtures', filepath);
        return new Vinyl({
            cwd: __dirname,
            base: path.dirname(file),
            path: file,
            contents: Buffer.from(fs.readFileSync(file))
        });
    }

    return array(args.map(create));
}

// Binary
describe('Streams', () => {
    after(() => {
        process.emit('cleanup');
    });

    it('should emit error on streamed file', done => {
        const stream = critical.stream({base: path.join(__dirname, 'fixtures')});
        const fakeFilePath = path.join(__dirname, 'fixtures', 'generate-default.html');

        fs.createReadStream(fakeFilePath)
            .pipe(vinylStream())
            .pipe(stream)
            .on('data', data => {
                assert.fail(null, data, 'Should not emit data');
            })
            .on('error', err => {
                assert.strictEqual(err.message, 'Streaming not supported');
                done();
            });
    });

    it('should support vinyl buffer streams', done => {
        const stream = critical.stream({base: path.join(__dirname, 'fixtures')});

        getVinyl('generate-default.html')
            .pipe(stream)
            .on('data', data => {
                assert.ok(data);
                done();
            })
            .on('error', err => {
                assert.fail(null, err, 'Should not emit an error');
                done();
            });
    });

    it('should work inside folders', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            inline: false,
            minify: true,
            inlineImages: true
        });

        const expected1 = read('expected/generate-default.css', true);

        getVinyl('folder/generate-default.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected1);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should use "generateInline" if inline option is set', done => {
        const stream = critical.stream({base: path.join(__dirname, 'fixtures'), inline: true});
        const expected = read('expected/generateInline.html');

        getVinyl('generateInline.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.first(d => {
                assert.strictEqual(path.extname(d.path), '.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should use "generate" if inline option is false', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            inline: false,
            minify: true,
            inlineImages: true
        });

        const expected1 = read('expected/generate-default.css', true);
        const expected2 = read('expected/generate-image.css', true);

        getVinyl('generate-default.html', 'generate-image.html')
            .pipe(stream)
            .pipe(streamAssert.length(2))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected1);
            }))
            .pipe(streamAssert.nth(1, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected2);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should ignore css files not specified when using css option', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            inline: false,
            minify: true,
            width: 1920,
            height: 3840,
            css: ['fixtures/styles/main.css']
        });

        const expected = read('expected/main.css', true);

        getVinyl('generate-default.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should ignore css files not specified when using css option (inline)', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            width: 1920,
            height: 3840,
            css: ['fixtures/styles/main.css'],
            inline: true
        });

        const expected = read('expected/streams-default.html');

        getVinyl('streams-default.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should respect ignore option (inline)', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            css: ['fixtures/styles/font.css'],
            inline: false,
            ignore: [/font-face/]
        });

        const expected = read('expected/generate-ignorefont.css');

        getVinyl('generate-ignorefont.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should respect ignore option (inline)', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            css: ['fixtures/styles/font.css'],
            inline: true,
            ignore: ['@font-face']
        });

        const expected = read('expected/generate-ignorefont.html');

        getVinyl('generate-ignorefont.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('#192 - include option - stream', done => {
        const stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            css: ['fixtures/styles/issue-192.css'],
            minify: true,
            extract: false,
            ignore: ['@font-face', /url\(/],
            dimensions: [{
                width: 320,
                height: 480
            }, {
                width: 768,
                height: 1024
            }, {
                width: 1280,
                height: 960
            }, {
                width: 1920,
                height: 1080
            }],
            include: [/^\.main-navigation.*$/,
                /^\.hero-deck.*$/,
                /^\.deck.*$/,
                /^\.search-box.*$/],
            width: 1300,
            height: 900
        });

        const expected = read('expected/issue-192.css');

        getVinyl('issue-192.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), nn(expected));
            }))
            .pipe(streamAssert.end(done));
    });

    it('should generate multi-dimension critical-path CSS in stream mode', done => {
        const expected = read('expected/generate-adaptive.css', 'utf8');

        const stream = critical.stream({
            base: 'fixtures/',
            dimensions: [{
                width: 100,
                height: 70
            }, {
                width: 1000,
                height: 70
            }]
        });

        getVinyl('generate-adaptive.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0, d => {
                assert.strictEqual(path.extname(d.path), '.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), nn(expected));
            }))
            .pipe(streamAssert.end(done));
    });
});
