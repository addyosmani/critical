<<<<<<< HEAD
import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
=======
import {join, dirname} from 'node:path';
import {Buffer} from 'node:buffer';
import {existsSync, unlinkSync, readFileSync} from 'node:fs';
>>>>>>> origin/feature/bump
import {fileURLToPath} from 'node:url';
import array from 'stream-array';
import Vinyl from 'vinyl';
import nn from 'normalize-newline';

<<<<<<< HEAD
export const __dirname = fileURLToPath(new URL('.', import.meta.url));
=======
const __dirname = dirname(fileURLToPath(import.meta.url));
>>>>>>> origin/feature/bump

export function getFile(file) {
  const testBase = join(__dirname, '..');
  if (existsSync(join(testBase, file))) {
    return join(testBase, file);
  }

  return file;
}

<<<<<<< HEAD
export function getPkg() {
  const content = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8');
  return JSON.parse(content);
}

=======
>>>>>>> origin/feature/bump
export function readAndRemove(file) {
  const fp = getFile(file);
  const content = read(fp);

  unlinkSync(fp);

  return content;
}

export function read(file) {
<<<<<<< HEAD
  const content = fs.readFileSync(getFile(file), 'utf8');
=======
  const content = readFileSync(getFile(file), 'utf8');
>>>>>>> origin/feature/bump

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
