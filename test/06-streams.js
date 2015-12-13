/*
 * Unit tests for Critical.
 */
/* jshint -W098 */
'use strict';
var path = require('path');
var fs = require('fs');
var assert = require('chai').assert;
var should = require('should');
var vinylStream = require('vinyl-source-stream');
var streamAssert = require('stream-assert');
var gutil = require('gulp-util');
var critical = require('../');
var pkg = require('../package.json');
var array = require('stream-array');
var read = require('./helper/testhelper').read;

var nn = require('normalize-newline');
var gc = require('../lib/gc');
gc.skipExceptions();

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

/**
 * Get vinyl file object
 * @param file
 * @returns {*|StreamArray|exports}
 */
function getVinyl(file) {
    var args = Array.prototype.slice.call(arguments);

    function create(filepath) {
        var file = path.join(__dirname, 'fixtures',filepath);
        return new gutil.File({
            cwd: __dirname,
            base: path.dirname(file),
            path: file,
            contents: new Buffer(fs.readFileSync(file))
        });
    }

    return array(args.map(create));
}


// binary
describe('Streams', function () {
    after(function(){
        process.emit('cleanup');
    });

    it('should emit error on streamed file', function(done){
        var stream = critical.stream({base: path.join(__dirname,'fixtures')});
        var fakeFilePath = path.join(__dirname, 'fixtures','generate-default.html');

        fs.createReadStream(fakeFilePath)
            .pipe(vinylStream())
            .pipe(stream)
            .on('data', function(data) {
                assert.fail(null,data,'Should not emit data');
            })
            .on('error', function (err) {
                err.message.should.eql('Streaming not supported');
                done();
            });
    });


    it('should support vinyl buffer streams', function(done){
        var stream = critical.stream({base: path.join(__dirname,'fixtures')});

        getVinyl('generate-default.html')
            .pipe(stream)
            .on('data', function(data) {
                assert.ok(data);
                done();
            })
            .on('error', function (err) {
                assert.fail(null,err,'Should not emit an error');
                done();
            });
    });

    it('should use "generateInline" if inline option is set', function (done) {
        var stream = critical.stream({base: path.join(__dirname, 'fixtures'), inline: true});
        var expected = read('expected/generateInline.html');

        getVinyl('generateInline.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.first(function (d) {
                path.extname(d.path).should.eql('.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should use "generate" if inline option is false', function (done) {
        var stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            inline: false,
            minify: true,
            inlineImages: true
        });

        var expected1 = read('expected/generate-default.css', true);
        var expected2 = read('expected/generate-image.css', true);

        getVinyl('generate-default.html', 'generate-image.html')
            .pipe(stream)
            .pipe(streamAssert.length(2))
            .pipe(streamAssert.nth(0,function (d) {
                path.extname(d.path).should.eql('.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected1);
            }))
            .pipe(streamAssert.nth(1,function (d) {
                path.extname(d.path).should.eql('.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected2);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should ignore css files not specified when using css option', function (done) {
        var stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            inline: false,
            minify: true,
            width: 1920,
            height: 3840,
            css: ['fixtures/styles/main.css']
        });

        var expected = read('fixtures/styles/main.css',true);

        getVinyl('generate-default.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0,function (d) {
                path.extname(d.path).should.eql('.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should ignore css files not specified when using css option (inline)', function (done) {
        var stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            width: 1920,
            height: 3840,
            css: ['fixtures/styles/main.css'],
            inline: true
        });

        var expected = read('expected/streams-default.html');

        getVinyl('streams-default.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0,function (d) {
                path.extname(d.path).should.eql('.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should respect ignore option (inline)', function(done){
        var stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            css: ['fixtures/styles/font.css'],
            inline: false,
            ignore: [/font-face/]
        });

        var expected = read('expected/generate-ignorefont.css');

        getVinyl('generate-ignorefont.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0,function (d) {
                path.extname(d.path).should.eql('.css');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });

    it('should respect ignore option (inline)', function(done){
        var stream = critical.stream({
            base: path.join(__dirname, 'fixtures'),
            css: ['fixtures/styles/font.css'],
            inline: true,
            ignore: ['@font-face']
        });

        var expected = read('expected/generate-ignorefont.html');

        getVinyl('generate-ignorefont.html')
            .pipe(stream)
            .pipe(streamAssert.length(1))
            .pipe(streamAssert.nth(0,function (d) {
                path.extname(d.path).should.eql('.html');
                assert.strictEqual(nn(d.contents.toString('utf8')), expected);
            }))
            .pipe(streamAssert.end(done));
    });
});
