'use strict';
var fs = require('fs');
var assert = require('assert');
var critical = require('./index');
var css = require('css');
var chai = require('chai');
var should = chai.should();

var isWindows = process.platform == 'win32';
var lineBreak = isWindows ? /\r\n/g : /\n/g;

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

/*
it('generates critical-path CSS successfully', function (done) {
    var expected = fs.readFile('fixture/styles/critical.css', 'utf8');

    critical.generate({
      base: 'fixture/',
      src: 'index.html',
      dest: 'styles/critical.css',
      width: 320,
      height: 480
    }, function (err, output) {
        var resultAst = css.parse(output);
        var expectedAst = css.parse(expected);
        resultAst.should.eql(expectedAst);
        done();
    });
});
*/

it('generates critical-path CSS without writing to disk', function () {
    var expected = fs.readFileSync('fixture/styles/critical-pregenerated.css', 'utf8').replace(lineBreak, '');

    critical.generate({
      base: 'fixture/',
      src: 'index.html',
      width: 320,
      height: 480
    }, function (err, output) {
        //var resultAst = css.parse(output);
        //var expectedAst = css.parse(expected);
        //resultAst.should.eql(expectedAst);
/////works  output = output.toString('utf-8').replace(lineBreak, '');
        assert.equal(output, expected);
        //done();
    });
});

/*
it('inlines critical-path CSS successfully', function (done) {
    var expected = fs.readFileSync('fixture/index-final.html', 'utf8');

    critical.inline({
      base: 'fixture/',
      src: 'index-critical.html',
      dest: 'test-final.html'
    }, function (err, output) {
      output.should.eql(expected);
      done();
    });
});

it('inlines critical-path CSS without writing to disk', function (done) {
    var expected = fs.readFileSync('fixture/index-test.html', 'utf8');

    critical.inline({
      base: 'fixture/',
      src: 'index-critical.html'
    }, function (err, output) {
      output.should.eql(expected);
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
      output.should.eql(expected);
      done();
    });
});
*/