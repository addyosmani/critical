'use strict';

const path = require('path');
const fs = require('fs');
const array = require('stream-array');
const Vinyl = require('vinyl');
const nn = require('normalize-newline');

function getFile(file) {
  const testBase = path.join(__dirname, '..');
  if (fs.existsSync(path.join(testBase, file))) {
    return path.join(testBase, file);
  }

  return file;
}

function readAndRemove(file) {
  const fp = getFile(file);
  const content = read(fp);

  fs.unlinkSync(fp);

  return content;
}

function read(file) {
  const content = fs.readFileSync(getFile(file), 'utf8');

  return nn(content);
}

function getVinyl(...args) {
  function create(filepath) {
    if (filepath) {
      const file = path.join(__dirname, '../fixtures', filepath);
      return new Vinyl({
        cwd: __dirname,
        base: path.dirname(file),
        path: file,
        contents: Buffer.from(read(file)),
      });
    }

    return new Vinyl();
  }

  return array(args.map((value) => create(value)));
}

function strip(string) {
  return nn(string.replace(/[\r\n]+/gm, ' ').replace(/\s+/gm, ''));
}

module.exports = {
  getVinyl,
  read,
  strip,
  readAndRemove,
};
