import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import array from 'stream-array';
import Vinyl from 'vinyl';
import nn from 'normalize-newline';

export const __dirname = fileURLToPath(new URL('.', import.meta.url));

function getFile(file) {
  const testBase = path.join(__dirname, '..');
  if (fs.existsSync(path.join(testBase, file))) {
    return path.join(testBase, file);
  }

  return file;
}

export function getPkg() {
  const content = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8');
  return JSON.parse(content);
}

export function readAndRemove(file) {
  const fp = getFile(file);
  const content = read(fp);

  fs.unlinkSync(fp);

  return content;
}

export function read(file) {
  const content = fs.readFileSync(getFile(file), 'utf8');

  return nn(content);
}

export function getVinyl(...args) {
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

export function strip(string) {
  return nn(string.replaceAll(/[\r\n]+/gm, ' ').replaceAll(/\s+/gm, ''));
}
