import process from 'node:process';
import path from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {jest} from '@jest/globals';
import vinylStream from 'vinyl-source-stream';
import Vinyl from 'vinyl';
import PluginError from 'plugin-error';
import nn from 'normalize-newline';
import streamAssert from 'stream-assert';
import {temporaryDirectory} from 'tempy';
import {ConfigError, FileNotFoundError, NoCssError} from '../src/errors.js';
import {generate, stream} from '..';
import {getVinyl, readAndRemove, read} from './helper/index.js';

jest.setTimeout(100_000);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const unlinkAsync = promisify(fs.unlink);

let stderr;
beforeEach(() => {
  stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderr.mockRestore();
});
test('Handle errors with passed callback method', (done) => {
  const tmp = generate({}, (error, data) => {
    expect(data).toBeFalsy();
    expect(error).toBeInstanceOf(Error);
    done();
  });

  expect(tmp).resolves.toBeUndefined();
});

test('Call callback function with object containing html, css and uncritical props', (done) => {
  generate({src: path.join(__dirname, 'fixtures/generate-default.html')}, (error, data) => {
    expect(error).toBeFalsy();
    expect(data).toHaveProperty('css');
    expect(data).toHaveProperty('html');
    expect(data).toHaveProperty('uncritical');
    done();
  });
});

test('Write css target', async () => {
  const data = await generate({src: path.join(__dirname, 'fixtures/generate-default.html'), target: '.test.css'});
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(fs.existsSync('.test.css')).toBeTruthy();

  const content = readAndRemove('.test.css');
  expect(content).toBe(data.css);
});

test('Write html target', async () => {
  const data = await generate({src: path.join(__dirname, 'fixtures/generate-default.html'), target: '.test.html'});
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(fs.existsSync('.test.html')).toBeTruthy();

  const content = readAndRemove('.test.html');
  expect(content).toBe(data.html);
});

test('Write all targets', async () => {
  const data = await generate({
    src: path.join(__dirname, 'fixtures/generate-default.html'),
    target: {html: '.test.html', css: '.test.css', uncritical: '.uncritical.css'},
  });
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(fs.existsSync('.test.css')).toBeTruthy();
  expect(fs.existsSync('.uncritical.css')).toBeTruthy();
  expect(fs.existsSync('.test.html')).toBeTruthy();

  const html = readAndRemove('.test.html');
  const css = readAndRemove('.test.css');
  readAndRemove('.uncritical.css');
  expect(html).toBe(data.html);
  expect(css).toBe(data.css);
});

test('Write all targets relative to base', async () => {
  const base = temporaryDirectory();
  const getFile = (f) => path.join(base, f);
  const data = await generate({
    base,
    src: path.join(__dirname, 'fixtures/generate-default.html'),
    target: {html: '.test.html', css: '.test.css', uncritical: '.uncritical.css'},
  });
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(data).toHaveProperty('uncritical');
  expect(fs.existsSync(getFile('.test.css'))).toBeTruthy();
  expect(fs.existsSync(getFile('.uncritical.css'))).toBeTruthy();
  expect(fs.existsSync(getFile('.test.html'))).toBeTruthy();

  const html = readAndRemove(getFile('.test.html'));
  const css = readAndRemove(getFile('.test.css'));
  const uncritical = readAndRemove(getFile('.uncritical.css'));
  expect(uncritical).toBe(data.uncritical);
  expect(html).toBe(data.html);
  expect(css).toBe(data.css);

  try {
    await unlinkAsync(base);
  } catch {
    // file not  there
  }
});

test('Write all targets respecting absolute paths', async () => {
  const base = temporaryDirectory();
  const fileBase = temporaryDirectory();
  const getFile = (f) => path.join(fileBase, f);
  const data = await generate({
    base,
    src: path.join(__dirname, 'fixtures/generate-default.html'),
    target: {html: getFile('.test.html'), css: getFile('.test.css'), uncritical: getFile('.uncritical.css')},
  });
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(data).toHaveProperty('uncritical');
  expect(fs.existsSync(getFile('.test.css'))).toBeTruthy();
  expect(fs.existsSync(getFile('.uncritical.css'))).toBeTruthy();
  expect(fs.existsSync(getFile('.test.html'))).toBeTruthy();

  const html = readAndRemove(getFile('.test.html'));
  const css = readAndRemove(getFile('.test.css'));
  const uncritical = readAndRemove(getFile('.uncritical.css'));
  expect(uncritical).toBe(data.uncritical);
  expect(html).toBe(data.html);
  expect(css).toBe(data.css);

  try {
    await unlinkAsync(base);
    await unlinkAsync(fileBase);
  } catch {
    // file already deleted
  }
});

test('Reject with ConfigError on invalid config', () => {
  expect(generate({})).rejects.toThrow(ConfigError);
});

test('Throws FileNotFound error on missing file', () => {
  expect(generate({src: 'not-found.html'})).rejects.toThrow(FileNotFoundError);
});

test('Throws NoCssError error on empty styles in strict mode', () => {
  expect(generate({src: path.join(__dirname, 'fixtures/error.html'), strict: true})).rejects.toThrow(NoCssError);
});

test('Emit error on streamed file', (done) => {
  const critical = stream({base: path.join(__dirname, 'fixtures')});
  const fakeFilePath = path.join(__dirname, 'fixtures', 'generate-default.html');

  expect.hasAssertions();
  fs.createReadStream(fakeFilePath)
    .pipe(vinylStream())
    .pipe(critical)
    .on('data', () => done.fail(new Error('Should not emit data')))
    .on('error', ({message}) => {
      expect(message).toBe('Streaming not supported');
      done();
    });
});

test('Throws PluginError on critical.stream error', (done) => {
  const critical = stream({invalidOption: true});

  getVinyl('error.html')
    .pipe(critical)
    .on('data', () => done.fail(new Error('Should not emit data')))
    .on('error', (error) => {
      expect(error).toBeInstanceOf(PluginError);
      expect(error.plugin).toBe('critical');
      done();
    });
});

test('Support vinyl buffer streams and return critical css vinyl', (done) => {
  const critical = stream({base: path.join(__dirname, 'fixtures')});

  getVinyl('generate-default.html')
    .pipe(critical)
    .on('data', (data) => {
      expect(data).toBeTruthy();
      expect(data).toBeInstanceOf(Vinyl);
      expect(data.path).toMatch(/\.css/);
      done();
    })
    .on('error', () => {
      done.fail(new Error('Should not emit error'));
      done();
    });
});

test('Support vinyl buffer streams and returns html vinyl with inlined css', (done) => {
  const critical = stream({base: path.join(__dirname, 'fixtures'), inline: true});

  getVinyl('generate-default.html')
    .pipe(critical)
    .on('data', (data) => {
      expect(data).toBeTruthy();
      expect(data).toBeInstanceOf(Vinyl);
      expect(data.path).toMatch(/\.html/);
      expect(data.contents.toString()).toMatch(/<style>/);
      done();
    })
    .on('error', () => {
      done.fail(new Error('Should not emit error'));
      done();
    });
});

test('Return empty vinyl on empty vinyl', (done) => {
  const critical = stream({base: path.join(__dirname, 'fixtures')});

  getVinyl(false)
    .pipe(critical)
    .on('data', (data) => {
      expect(data).toBeTruthy();
      expect(data).toBeInstanceOf(Vinyl);
      expect(data.isNull).toBeTruthy();
      done();
    })
    .on('error', () => {
      done.fail(new Error('Should not emit error'));
      done();
    });
});

test('#192 - include option - stream', (done) => {
  const critical = stream({
    base: path.join(__dirname, 'fixtures'),
    css: ['fixtures/styles/issue-192.css'],
    extract: false,
    ignore: ['@font-face', /url\(/],
    dimensions: [
      {
        width: 320,
        height: 480,
      },
      {
        width: 768,
        height: 1024,
      },
      {
        width: 1280,
        height: 960,
      },
      {
        width: 1920,
        height: 1080,
      },
    ],
    include: [/^\.main-navigation.*$/, /^\.hero-deck.*$/, /^\.deck.*$/, /^\.search-box.*$/],
    width: 1300,
    height: 900,
  });

  const expected = read('expected/issue-192.css');

  getVinyl('issue-192.html')
    .pipe(critical)
    .pipe(streamAssert.length(1))
    .pipe(
      streamAssert.nth(0, (d) => {
        expect(path.extname(d.path)).toBe('.css');
        expect(nn(d.contents.toString('utf8'))).toBe(expected);
      })
    )
    .pipe(streamAssert.end(done));
});

test('should generate multi-dimension critical-path CSS in stream mode', (done) => {
  const expected = read('expected/generate-adaptive.css', 'utf8');

  const critical = stream({
    base: 'fixtures/',
    dimensions: [
      {
        width: 100,
        height: 70,
      },
      {
        width: 1000,
        height: 70,
      },
    ],
  });

  getVinyl('generate-adaptive.html')
    .pipe(critical)
    .pipe(streamAssert.length(1))
    .pipe(
      streamAssert.nth(0, (d) => {
        expect(path.extname(d.path)).toBe('.css');
        expect(nn(d.contents.toString('utf8'))).toBe(expected);
      })
    )
    .pipe(streamAssert.end(done));
});

test('issue 341', async () => {
  const expected = [];
  const sources = [
    read('fixtures/generate-adaptive.html', 'utf8'),
    read('fixtures/generate-default.html', 'utf8'),
    read('fixtures/generate-image.html', 'utf8'),
  ];

  const options = {
    base: path.join(__dirname, 'fixtures'),
    extract: false,
    inline: false,
    dimensions: [
      {
        width: 100,
        height: 70,
      },
      {
        width: 1000,
        height: 70,
      },
    ],
  };

  // first await all results regularly
  expected[0] = await generate({...options, html: sources[0]});
  expected[1] = await generate({...options, html: sources[1]});
  expected[2] = await generate({...options, html: sources[2]});

  // limit concurrency and run all processes in parallel
  const promises = sources.map((html) => generate({...options, html, concurrency: 2}));
  const results = await Promise.all(promises);

  expect(results[0].css).toBe(expected[0].css);
  expect(results[1].css).toBe(expected[1].css);
  expect(results[2].css).toBe(expected[2].css);
});

test('Replace stylesheet on extract-target', async () => {
  const target = path.join(__dirname, 'fixtures/styles/uncritical.css');
  const result = await generate({
    html: read('fixtures/generate-adaptive.html'),
    base: path.join(__dirname, 'fixtures'),
    target: {uncritical: target},
    extract: true,
    inline: true,
  });

  const uncritical = readAndRemove(target);

  expect(result.html).toMatch('"/styles/uncritical.css"');
  expect(uncritical).toBe(result.uncritical);
});

test('Remove stylesheet on empty uncritical css', async () => {
  const result = await generate({
    html: read('fixtures/issue-304.html'),
    base: path.join(__dirname, 'fixtures'),
    extract: true,
    inline: true,
  });

  expect(result.html).not.toMatch('<link');
  expect(result.uncritical).toBe(result.uncritical);
});

test('Use async cb result for inline.replaceStylesheets', async () => {
  const cb = () => Promise.resolve(['ab.css']);
  const result = await generate({
    html: read('fixtures/issue-304.html'),
    base: path.join(__dirname, 'fixtures'),
    extract: true,
    inline: {
      replaceStylesheets: cb,
    },
  });

  expect(result.html).toMatch('"ab.css"');
  expect(result.uncritical).toBe(result.uncritical);
});
