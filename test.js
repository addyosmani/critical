'use strict';
var fs = require('fs');
var assert = require('assert');
var critical = require('./index');

it('Generate and inline critical-path CSS', function (done) {
	critical({
	  src: 'test/index.html',
	  base: 'test/',
	  styleOutput: 'test/styles.css',
	  width: '320',
	  height: '480',
	  dest: 'test/test1.html'
	}, function(output){
		var expected  = fs.readFileSync('test/test1.expected.html');
		assert(expected == String(output));
		done();
	});
});


