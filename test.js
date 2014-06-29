'use strict';
var fs = require('fs');
var assert = require('assert');
var critical = require('./index');

it('throws on CSS generation if src and dest not specified', function (done) {
	critical.generate({}, function (err, output){
	    if(/Error: A valid source and base path are required./.test(err[0])) {
	        return true;
	    }
		done();
	});
});

it('throws on inlining if src and dest not specified', function (done) {
	critical.inline({}, function (err, output){
	    if(/Error: A valid source and base path are required./.test(err[0])) {
	        return true;
	    }
		done();
	});
});

it('generates critical-path CSS successfully', function (done) {
	var expected  = fs.readFileSync('fixture/styles/critical.css');
	critical.generate({
	  base: 'fixture/',
	  src: 'index.html',
	  dest: 'styles/critical.css',
	  width: 320,
	  height: 480
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

it('generates minified critical-path CSS successfully', function (done) {
	var expected  = fs.readFileSync('fixture/styles/critical-min.css');
	critical.generate({
	  base: 'fixture/',
	  src: 'index.html',
	  minify: true,
	  width: 320,
	  height: 480
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

it('generates critical-path CSS without writing to disk', function (done) {
	var expected  = fs.readFileSync('fixture/styles/critical-pregenerated.css');
	critical.generate({
	  base: 'fixture/',
	  src: 'index.html',
	  width: 320,
	  height: 480
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

it('inlines critical-path CSS successfully', function (done) {
	var expected  = fs.readFileSync('fixture/index-test.html');
	critical.inline({
	  base: 'fixture/',
	  src: 'index-critical.html',
	  dest: 'test-final.html'
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

it('inlines critical-path CSS without writing to disk', function (done) {
	var expected  = fs.readFileSync('fixture/index-test.html');
	critical.inline({
	  base: 'fixture/',
	  src: 'index-critical.html',
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

it('inlines and minified critical-path CSS', function (done) {
	var expected  = fs.readFileSync('fixture/index-inlined-minified.html');
	critical.inline({
	  base: 'fixture/',
	  minify: true,
	  dest: 'test-inlined-minified.html',
	  src: 'index-critical.html',
	}, function (err, output){
		assert(expected == String(output));
		done();
	});
});

