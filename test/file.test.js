/* eslint-disable no-await-in-loop */
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import path from 'node:path';
import {promisify} from 'node:util';
import fs from 'node:fs';
import {jest} from '@jest/globals';
import getPort from 'get-port';
import Vinyl from 'vinyl';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import {mapAsync} from '../src/array.js';
import {FileNotFoundError} from '../src/errors.js';
import {
  BASE_WARNING,
  isRemote,
  isAbsolute,
  checkCssOption,
  fileExists,
  joinPath,
  urlParse,
  resolve,
  vinylize,
  normalizePath,
  getStylesheetHrefs,
  getAssets,
  getDocumentPath,
  getStylesheetPath,
  getDocument,
  getDocumentFromSource,
  getStylesheet,
} from '../src/file.js';
import {read, strip} from './helper/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const readFileAsync = promisify(fs.readFile);

// Setup static fileserver to mimic remote requests
let server;
let port;
beforeAll(async () => {
  const root = path.join(__dirname, 'fixtures');
  const serve = serveStatic(root, {index: ['index.html', 'index.htm']});
  port = await getPort();

  server = createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  }).listen(port);
});

afterAll(() => server.close());

// Prepare stderr mock
let stderr;
beforeEach(() => {
  stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderr.mockRestore();
});

test('checkCssOption', () => {
  expect(checkCssOption(undefined)).toEqual(false);
  expect(checkCssOption('')).toEqual(false);
  expect(checkCssOption(false)).toEqual(false);
  expect(checkCssOption([])).toEqual(false);
  expect(checkCssOption(['abc'])).toEqual(true);
  expect(checkCssOption('abc')).toEqual(true);
});

test('Normalize paths', () => {
  const plattform = process.platform;
  Object.defineProperty(process, 'platform', {value: 'win32'});
  expect(normalizePath('foo\\bar')).toBe('foo/bar');
  expect(normalizePath('C:\\images\\critical.png')).toBe('/images/critical.png');
  expect(normalizePath(`http://localhost:${port}/styles/main.css`)).toBe(`http://localhost:${port}/styles/main.css`);
  Object.defineProperty(process, 'platform', {value: plattform});
});

test('Remote file detection', () => {
  const local = ['../test/foo.html', '/usr/tmp/bar'];
  const remote = ['https://test.io/', '//test.io/styles/main.css'];

  local.forEach((p) => expect(isRemote(p)).toBe(false));
  remote.forEach((p) => expect(isRemote(p)).toBe(true));
});

test('Absolute file detection', () => {
  const invalid = ['', false, {}];
  const absolute = ['/usr/tmp/bar'];
  const relative = ['../test/foo.html', './usr/tmp/bar'];
  const remote = ['https://test.io/', '//test.io/styles/main.css'];

  invalid.forEach((p) => expect(isAbsolute(p)).toBe(false));
  relative.forEach((p) => expect(isAbsolute(p)).toBe(false));
  remote.forEach((p) => expect(isAbsolute(p)).toBe(false));
  absolute.forEach((p) => expect(isAbsolute(p)).toBe(true));
});

test('Error for file not found', () => {
  expect(vinylize({filenpath: 'non-existant-file.html'})).rejects.toThrow(FileNotFoundError);
});

test('fileExists', async () => {
  const tests = [
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: true},
    {filepath: path.join(__dirname, 'fixtures/not-available'), expected: false},
    {filepath: `http://localhost:${port}/head.html`, expected: true},
    {filepath: `http://localhost:${port}/styles/main.css`, expected: true},
    {filepath: `http://localhost:${port}/styles/nope.css`, expected: false},
  ];

  expect.assertions(tests.length);
  for (const {filepath, expected} of tests) {
    const result = await fileExists(filepath);
    expect(result).toBe(expected);
  }
});

test('joinPath', () => {
  const tests = [
    {base: '/folder/subfolder/head', part: 'test.html', expected: '/folder/subfolder/head/test.html'},
    {base: '/folder/subfolder/head', part: '../../test.html', expected: '/folder/test.html'},
    {base: `http://localhost:${port}`, part: '../../test.html', expected: `http://localhost:${port}/test.html`},
    {base: `http://localhost:${port}/a/b/c`, part: '../../test.html', expected: `http://localhost:${port}/test.html`},
    {
      base: `http://localhost:${port}/a/b/c/d.html`,
      part: 'test.html',
      expected: `http://localhost:${port}/a/b/c/test.html`,
    },
    {
      base: `http://localhost:${port}/a/b/c/d.html`,
      part: '../test.html',
      expected: `http://localhost:${port}/a/b/test.html`,
    },
  ];

  expect.assertions(tests.length);
  for (const {base, part, expected} of tests) {
    const result = joinPath(base, part);
    expect(normalizePath(result)).toBe(expected);
  }
});

test('resolve', async () => {
  const tests = [
    {
      filepath: '/folder/subfolder/head.html',
      paths: [__dirname, path.join(__dirname, 'fixtures'), `http://localhost:${port}`],
      expected: path.join(__dirname, 'fixtures/folder/subfolder/head.html'),
    },
    {
      filepath: '/folder/subfolder/head.html',
      paths: [__dirname, `http://localhost:${port}`, path.join(__dirname, 'fixtures/folder/subfolder/head.html')],
      expected: `http://localhost:${port}/folder/subfolder/head.html`,
    },
    {
      filepath: '../styles/main.css',
      paths: [
        __dirname,
        `http://localhost:${port}`,
        `http://localhost:${port}/folder/`,
        path.join(__dirname, 'fixtures/folder/subfolder/head.html'),
      ],
      expected: `http://localhost:${port}/styles/main.css`,
    },
  ];

  expect.assertions(tests.length);
  for (const {filepath, paths, expected} of tests) {
    const result = await resolve(filepath, paths);
    expect(result).toBe(expected);
  }
});

test('resolve error', () => {
  const paths = [__dirname, `http://localhost:${port}`];
  expect(resolve('non-existant-file.html', paths)).rejects.toThrow(FileNotFoundError);
});

test('Vinylize local file', async () => {
  const files = [
    path.join(__dirname, 'fixtures/folder/subfolder/head.html'),
    path.join(__dirname, 'fixtures/head.html'),
  ];

  const contents = await Promise.all(files.map((f) => readFileAsync(f)));
  const result = await Promise.all(files.map((filepath) => vinylize({filepath})));

  expect.hasAssertions();
  expect(result.length).toBe(files.length);

  for (const [i, element] of result.entries()) {
    expect(element.path).toBe(files[i]);
    expect(element.remote).toBe(false);
    expect(element.url).toBe(undefined);
    expect(element.urlObj).toBe(undefined);
    expect(element.contents.toString()).toBe(contents[i].toString());
  }

  return true;
});

test('Vinylize remote file', async () => {
  const files = [
    'fixtures/folder/subfolder/head.html',
    'fixtures/head.html',
    'fixtures/styles/main.css',
    'fixtures/images/critical.png',
  ];

  const contents = await Promise.all(files.map((f) => readFileAsync(path.join(__dirname, f))));

  const urls = files.map((f) => f.replace(/^fixtures/, `http://localhost:${port}`));
  const result = await Promise.all(urls.map((filepath) => vinylize({filepath})));

  // expect.assertions(files.length * 4 + 1);
  expect(result.length).toBe(files.length);

  for (const [i, element] of result.entries()) {
    expect(element.remote).toBe(true);
    expect(element.url).toBe(urls[i]);
    expect(element.urlObj).toEqual(urlParse(urls[i]));
    expect(element.contents.toString()).toBe(contents[i].toString());
  }

  expect.hasAssertions();
});

test('Append stylesheets to vinyl', async () => {
  const files = [
    'fixtures/folder/subfolder/head.html',
    'fixtures/folder/generate-default.html',
    'fixtures/head.html',
    'fixtures/styles/main.css',
    'fixtures/images/critical.png',
  ];

  const vinyls = await Promise.all(files.map((f) => vinylize({filepath: path.join(__dirname, f)})));
  const result = vinyls.map((v) => getStylesheetHrefs(v));
  expect.assertions(files.length + 6);
  expect(result.length).toBe(5);
  result.forEach((stylesheets) => expect(Array.isArray(stylesheets)).toBeTruthy());
  expect(result[0].length).toBe(1);
  expect(result[1].length).toBe(2);
  expect(result[2].length).toBe(2);
  expect(result[3].length).toBe(0);
  expect(result[4].length).toBe(0);
});

test('Append assets to vinyl', async () => {
  const files = [
    'fixtures/folder/subfolder/head.html',
    'fixtures/head.html',
    'fixtures/styles/bootstrap.css',
    'fixtures/styles/image-relative.css',
    'fixtures/images/critical.png',
  ];

  const vinyls = await Promise.all(files.map((f) => vinylize({filepath: path.join(__dirname, f)})));
  const result = vinyls.map((v) => getAssets(v));
  expect.assertions(files.length + 6);
  expect(result.length).toBe(5);
  result.forEach((assets) => expect(Array.isArray(assets)).toBeTruthy());
  expect(result[0].length).toBe(0);
  expect(result[1].length).toBe(0);
  expect(result[2].length).toBe(5);
  expect(result[3].length).toBe(1);
  expect(result[4].length).toBe(0);
});

test('Compute document base (with base option)', async () => {
  const vinyls = await Promise.all(
    [
      {filepath: `http://localhost:${port}/folder/generate-default.html`, expected: '/folder'},
      {filepath: `http://localhost:${port}/folder/head.html`, expected: '/folder'},
      {filepath: `http://localhost:${port}/generate-default.html`, expected: '/'},
      {filepath: `http://localhost:${port}/folder`, expected: '/folder'},
      {filepath: `http://localhost:${port}/folder/`, expected: '/folder'},
      {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder'},
      {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder'},
      {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/'},
      {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder'},
      {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder'},
    ].map((f) => vinylize(f).then((vinyl) => ({...f, vinyl})))
  );

  const files = vinyls.map((data) => {
    data.vinyl.stylesheets = getStylesheetHrefs(data.vinyl);
    return data;
  });

  expect.hasAssertions();
  for (const file of files) {
    const filepath = await getDocumentPath(file.vinyl, {base: path.join(__dirname, 'fixtures')});
    expect(path.dirname(filepath)).toBe(file.expected);
  }

  expect(stderr).not.toHaveBeenCalled();
});

test('Compute document base (without base option)', async () => {
  const vinyls = await Promise.all(
    [
      {filepath: `http://localhost:${port}/folder`, expected: '/folder'},
      {filepath: `http://localhost:${port}/folder/`, expected: '/folder'},
      {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder'},
      {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder'},
      {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/'},
      {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder'},
      {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder'},
    ].map((f) => vinylize(f).then((vinyl) => ({...f, vinyl})))
  );

  const files = vinyls.map((data) => {
    data.vinyl.stylesheets = getStylesheetHrefs(data.vinyl);
    return data;
  });

  expect.hasAssertions();
  for (const file of files) {
    const filepath = await getDocumentPath(file.vinyl);
    expect(path.dirname(filepath)).toBe(file.expected);
    if (file.noBase) {
      expect(stderr).toHaveBeenCalledWith(BASE_WARNING);
    }
  }
});

test('Get document', async () => {
  const file = path.join(__dirname, 'fixtures/folder/relative.html');
  const vinyl = new Vinyl({
    path: file,
    contents: Buffer.from(read(file)),
  });

  const tests = [
    {filepath: `http://localhost:${port}/folder`, expected: '/folder/index.html'},
    {filepath: `http://localhost:${port}/folder/`, expected: '/folder/index.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder/head.html'},
    {
      filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'),
      expected: '/folder/generate-default.html',
    },
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/head.html'},
    {
      filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'),
      expected: '/folder/subfolder/relative.html',
    },
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder/relative.html'},
    {
      filepath: 'folder/relative.html',
      options: {base: path.join(__dirname, 'fixtures')},
      expected: '/folder/relative.html',
    },
    {filepath: vinyl, options: {base: path.join(__dirname, 'fixtures')}, expected: '/folder/relative.html'},
  ];

  expect.hasAssertions();
  for (const testdata of tests) {
    const {filepath, expected, options} = testdata;
    const file = await getDocument(filepath, options);
    expect(file.virtualPath).toBe(expected);
    if (testdata.noBase) {
      expect(stderr).toHaveBeenCalledWith(BASE_WARNING);
    }
  }
});

test('Get document from source with rebase option', async () => {
  const base = path.join(__dirname, 'fixtures');
  const tests = [
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder/head.html'},
    {
      filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'),
      expected: '/folder/generate-default.html',
    },
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/head.html'},
    {
      filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'),
      expected: '/folder/subfolder/relative.html',
    },
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder/relative.html'},
  ];

  // expect.assertions(tests.length + 1);
  for (const testdata of tests) {
    const {filepath, expected} = testdata;
    const rebase = {to: `/${normalizePath(path.relative(base, filepath))}`};
    const source = await readFileAsync(filepath);
    const file = await getDocumentFromSource(source, {rebase, base});
    expect(file.virtualPath).toBe(expected);
  }

  expect(stderr).not.toHaveBeenCalled();
});

test('Get document from source without path options', async () => {
  const filepath = path.join(__dirname, 'fixtures/folder/subfolder/head.html');
  const source = await readFileAsync(filepath);
  const css = path.join(__dirname, 'fixtures/styles/image-relative.css');
  const file = await getDocumentFromSource(source, {css});
  const styles = await readFileAsync(css, 'utf8');

  // expect(file.path).toBe(undefined);
  expect(file.css).toMatch(styles);
  expect(stderr).toHaveBeenCalled();
});

test('Compute base for stylesheets', async () => {
  const docs = await mapAsync(
    [
      `http://localhost:${port}/generate-image.html`,
      path.join(__dirname, 'fixtures/folder/generate-image.html'),
      `http://localhost:${port}/folder/relative-different.html`,
      path.join(__dirname, 'fixtures/relative-different.html'),
      path.join(__dirname, 'fixtures/remote-different.html'),
    ],
    async (filepath) => {
      const document = await vinylize({filepath});
      document.stylesheets = await getStylesheetHrefs(document);
      document.virtualPath = await getDocumentPath(document);
      return document;
    }
  );

  const tests = [
    {
      filepath: `http://localhost:${port}/styles/image-relative.css`,
      expected: [
        '/styles/image-relative.css',
        `http://localhost:${port}/styles/image-relative.css`,
        `/styles/image-relative.css`,
        `http://localhost:${port}/styles/image-relative.css`,
        `http://localhost:${port}/styles/image-relative.css`,
      ],
    },
    {
      filepath: `http://127.0.0.1:${port}/styles/image-relative.css`,
      expected: [
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
      ],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      expected: [
        '/styles/image-relative.css',
        '/styles/image-relative.css',
        '/folder/styles/image-relative.css',
        '/styles/image-relative.css',
        'http://www.cdn.somewhere/styles/image-relative.css',
      ],
    },
  ];

  expect.assertions(docs.length * tests.length);

  for (const [index, document] of docs.entries()) {
    for (const testdata of tests) {
      const {filepath, expected} = testdata;
      const file = await vinylize({filepath});
      const result = await getStylesheetPath(document, file);

      expect(result).toBe(expected[index]);
    }
  }
});

test('Get styles', async () => {
  const docs = await mapAsync(
    [`http://localhost:${port}/generate-image.html`, path.join(__dirname, 'fixtures/folder/generate-image.html')],
    (filepath) => getDocument(filepath)
  );

  const tests = [
    {
      filepath: `http://localhost:${port}/styles/image-relative.css`,
      expected: ['images/critical.png', `http://localhost:${port}/images/critical.png`],
    },
    {
      filepath: `http://localhost:${port}/folder/subfolder/issue-216.css`,
      expected: [
        `folder/fonts/fontawesome-webfont.woff`,
        `http://localhost:${port}/folder/fonts/fontawesome-webfont.woff`,
      ],
    },
    {
      filepath: `http://127.0.0.1:${port}/styles/image-relative.css`,
      expected: [`http://127.0.0.1:${port}/images/critical.png`, `http://127.0.0.1:${port}/images/critical.png`],
    },
    {
      filepath: `http://127.0.0.1:${port}/folder/subfolder/issue-216.css`,
      expected: [
        `http://127.0.0.1:${port}/folder/fonts/fontawesome-webfont.woff`,
        `http://127.0.0.1:${port}/folder/fonts/fontawesome-webfont.woff`,
      ],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      expected: ['images/critical.png', '../images/critical.png'],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      options: {rebase: {from: '/styles/main.css', to: '/index.html'}},
      expected: ['images/critical.png', 'images/critical.png'],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      options: {rebase: {from: '/styles/main.css', to: '/a/b/c/index.html'}},
      expected: ['../../../images/critical.png', '../../../images/critical.png'],
    },

    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      options: {rebase: (asset) => `https://my-cdn.com${asset.absolutePath}`},
      expected: ['https://my-cdn.com/images/critical.png', 'https://my-cdn.com/images/critical.png'],
    },
  ];

  for (const [index, document] of docs.entries()) {
    for (const testdata of tests) {
      const {filepath, expected, options = {}} = testdata;
      const file = await getStylesheet(document, filepath, {
        base: path.join(__dirname, 'fixtures'),
        ...options,
      });
      expect(file.contents.toString()).toMatch(expected[index]);
    }
  }
});

test('Get inline styles', async () => {
  const docs = await mapAsync(
    [
      `http://localhost:${port}/generate-adaptive.html`,
      `http://localhost:${port}/generate-adaptive-inline.html`,
      path.join(__dirname, 'fixtures/generate-adaptive-inline.html'),
    ],
    (filepath) => getDocument(filepath)
  );

  const [expected, ...cssArray] = docs.map((doc) => strip(doc.css));

  for (const css of cssArray) {
    expect(css).toMatch(expected);
  }
});

test('Get styles with media attribute', async () => {
  const docs = await mapAsync(
    [`http://localhost:${port}/media-attr.html`, path.join(__dirname, 'fixtures/media-attr.html')],
    (filepath) => getDocument(filepath)
  );

  const expected = `@media (max-width: 1024px) { .header {
    display: flex;
} }`;

  for (const document of docs) {
    expect(document.css.toString()).toMatch(expected);
  }
});

test('Get base64 styles', async () => {
  const docs = await mapAsync(
    [
      `http://localhost:${port}/generate-adaptive.html`,
      `http://localhost:${port}/generate-adaptive-base64.html`,
      path.join(__dirname, 'fixtures/generate-adaptive-base64.html'),
    ],
    (filepath) => getDocument(filepath)
  );

  const [expected, ...cssArray] = docs.map((doc) => strip(doc.css));

  for (const css of cssArray) {
    expect(css).toMatch(expected);
  }
});

test('Get styles (without path)', async () => {
  const docs = await mapAsync(
    [
      path.join(__dirname, 'fixtures/folder/generate-image.html'),
      path.join(__dirname, 'fixtures/relative-different.html'),
      path.join(__dirname, 'fixtures/remote-different.html'),
    ],
    (file) => readFileAsync(file)
  );

  const tests = [
    {
      filepath: `http://localhost:${port}/styles/image-relative.css`,
      expected: [
        `http://localhost:${port}/images/critical.png`,
        `http://localhost:${port}/images/critical.png`,
        `http://localhost:${port}/images/critical.png`,
      ],
    },
    {
      filepath: `http://127.0.0.1:${port}/styles/image-relative.css`,
      expected: [
        `http://127.0.0.1:${port}/images/critical.png`,
        `http://127.0.0.1:${port}/images/critical.png`,
        `http://127.0.0.1:${port}/images/critical.png`,
      ],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      expected: [`'/images/critical.png'`, `'/images/critical.png'`, `'/images/critical.png'`],
    },
  ];

  for (const [index, element] of docs.entries()) {
    for (const testdata of tests) {
      const {filepath, expected} = testdata;
      const document = await getDocumentFromSource(element, {css: filepath});
      const file = await getStylesheet(document, filepath, {base: path.join(__dirname, 'fixtures')});
      expect(file.contents.toString()).toMatch(expected[index]);
    }
  }
});

test('Does not rebase when rebase is disabled via option', async () => {
  const docs = await mapAsync(
    [
      path.join(__dirname, 'fixtures/folder/generate-image.html'),
      path.join(__dirname, 'fixtures/relative-different.html'),
      path.join(__dirname, 'fixtures/remote-different.html'),
    ],
    (file) => readFileAsync(file)
  );

  const tests = [
    {
      filepath: `http://localhost:${port}/styles/image-relative.css`,
      expected: [`'../images/critical.png'`, `'../images/critical.png'`, `'../images/critical.png'`],
    },
    {
      filepath: `http://127.0.0.1:${port}/styles/image-relative.css`,
      expected: [`'../images/critical.png'`, `'../images/critical.png'`, `'../images/critical.png'`],
    },
    {
      filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'),
      expected: [`'../images/critical.png'`, `'../images/critical.png'`, `'../images/critical.png'`],
    },
  ];

  for (const [index, element] of docs.entries()) {
    for (const testdata of tests) {
      const {filepath, expected} = testdata;
      const document = await getDocumentFromSource(element, {css: filepath});
      const file = await getStylesheet(document, filepath, {base: path.join(__dirname, 'fixtures'), rebase: false});
      expect(file.contents.toString()).toMatch(expected[index]);
    }
  }
});
