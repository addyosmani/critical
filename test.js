/*
  Unit tests for Critical.
  
  Note: At present, our tests will pass on Unix based systems but fail on
  Windows. This is a known issue to do with line-endings which we hope to
  address in the very near future.
*/
'use strict';
var fs = require('fs');
var assert = require('assert');
var critical = require('./index');

it('throws on CSS generation if src and dest not specified', function () {
    assert.throws(function () {
        critical.generate({});
    });
});

it('throws on inlining if src and dest not specified', function () {
    assert.throws(function () {
        critical.inline({});
    });
});

it('generates critical-path CSS successfully', function (done) {
    var expected = fs.readFileSync('fixture/styles/critical.css', 'utf8');

    critical.generate({
      base: 'fixture/',
      src: 'index.html',
      dest: 'styles/critical.css',
      width: 320,
      height: 70
    }, function (err, output) {
        assert.strictEqual(output, expected);
        done();
    });
});

it('generates minified critical-path CSS successfully', function (done) {
    var expected = fs.readFileSync('fixture/styles/critical-min.css', 'utf8');

    critical.generate({
      base: 'fixture/',
      src: 'index.html',
      minify: true,
      width: 320,
      height: 70
    }, function (err, output) {
        assert.strictEqual(output, expected);
        done();
    });
});

it('generates minified critical-path CSS successfully with external css file configured', function (done) {
    var expected = fs.readFileSync('fixture/styles/critical-min.css', 'utf8');

    critical.generate({
        base: 'fixture/',
        src: 'index.html',
        css: ['external/styles/main.css','fixture/styles/unused.css'],
        minify: true,
        width: 320,
        height: 70
    }, function (err, output) {
        assert.strictEqual(output, expected);
        done();
    });
});

it('generates critical-path CSS without writing to disk', function (done) {
    var expected = fs.readFileSync('fixture/styles/critical-pregenerated.css', 'utf8');

    critical.generate({
      base: 'fixture/',
      src: 'index.html',
      width: 320,
      height: 70
    }, function (err, output) {
        assert.strictEqual(output, expected);
        done();
    });
});

it('inlines critical-path CSS successfully', function (done) {
    var expected = fs.readFileSync('fixture/index-final.html', 'utf8');

    critical.inline({
      base: 'fixture/',
      src: 'index-critical.html',
      dest: 'test-final.html'
    }, function (err, output) {
      assert.strictEqual(output, expected);
      done();
    });
});

it('inlines critical-path CSS without writing to disk', function (done) {
    var expected = fs.readFileSync('fixture/index-test.html', 'utf8');

    critical.inline({
      base: 'fixture/',
      src: 'index-critical.html'
    }, function (err, output) {
      assert.strictEqual(output, expected);
      done();
    });
});

it('inlines and minified critical-path CSS', function (done) {
    var expected = fs.readFileSync('fixture/index-inlined-minified.html', 'utf8');

    critical.inline({
      base: 'fixture/',
      minify: true,
      src: 'index-critical.html',
      dest: 'test-inlined-minified.html'
    }, function (err, output) {
      assert.strictEqual(output, expected);
      done();
    });
});
