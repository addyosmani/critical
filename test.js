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
	critical.generate({
	  base: 'fixture/',
	  src: 'index.html',
	  dest: 'styles/critical.css',
	  width: 320,
	  height: 480
	}, function (err, output){
		var expected  = fs.readFileSync('fixture/styles/critical.css');
		assert(expected == String(output));
		done();
	});
});

it('generates critical-path CSS without writing to disk', function (done) {
	critical.generate({
	  base: 'fixture/',
	  src: 'index.html',
	  width: 320,
	  height: 480
	}, function (err, output){
		var expected  = fs.readFileSync('fixture/styles/critical-pregenerated.css');
		assert(expected == String(output));
		done();
	});
});

it('inlines critical-path CSS successfully', function (done) {
	critical.inline({
	  base: 'fixture/',
	  src: 'index-critical.html',
	  dest: 'index-final.html'
	}, function (err, output){
		var expected  = fs.readFileSync('fixture/index-test.html');
		assert(expected == String(output));
		done();
	});
});

it('inlines critical-path CSS without writing to disk', function (done) {
	critical.inline({
	  base: 'fixture/',
	  src: 'index-critical.html',
	}, function (err, output){
		var expected  = fs.readFileSync('fixture/index-test.html');
		assert(expected == String(output));
		done();
	});
});

