import {join, dirname} from 'node:path';
import {Buffer} from 'node:buffer';
import {existsSync, unlinkSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import array from 'stream-array';
import Vinyl from 'vinyl';
import nn from 'normalize-newline';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getFile(file) {
  const testBase = join(__dirname, '..');
  if (existsSync(join(testBase, file))) {
    return join(testBase, file);
  }

  return file;
}

export function readAndRemove(file) {
  const fp = getFile(file);
  const content = read(fp);

  unlinkSync(fp);

  return content;
}

export function read(file) {
  const content = readFileSync(getFile(file), 'utf8');

  return nn(content);
}

export function getVinyl(...args) {
  function create(filepath) {
    if (filepath) {
      const file = join(__dirname, '../fixtures', filepath);
      return new Vinyl({
        cwd: __dirname,
        base: dirname(file),
        path: file,
        contents: Buffer.from(read(file)),
      });
    }

    return new Vinyl();
  }

  return array(args.map((value) => create(value)));
}

export function strip(string) {
  return nn(string.replace(/[\r\n]+/gm, ' ').replace(/\s+/gm, ''));
}
