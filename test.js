'use strict';
var fs = require('fs');
var assert = require('assert');
var critical = require('./index');

it('Generation should fail if src and dest not specified', function (done) {
	critical.generate({}, function (err, output){
	    if(/Error: A valid source and base path are required./.test(err[0])) {
	        return true;
	    }
		done();
	});
});

it('Inlining should fail if src and dest not specified', function (done) {
	critical.inline({}, function (err, output){
	    if(/Error: A valid source and base path are required./.test(err[0])) {
	        return true;
	    }
		done();
	});
});

it('Generate critical-path CSS', function (done) {
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

it('Generate critical-path CSS without needing to write to disk', function (done) {
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

it('Inline critical-path CSS', function (done) {
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

it('Inline critical-path CSS without needing to write to disk', function (done) {
	critical.inline({
	  base: 'fixture/',
	  src: 'index-critical.html',
	}, function (err, output){
		var expected  = fs.readFileSync('fixture/index-test.html');
		assert(expected == String(output));
		done();
	});
});

