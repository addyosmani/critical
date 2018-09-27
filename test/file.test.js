/* eslint-env jest node */
const {createServer} = require('http');
const getPort = require('get-port');
const fs = require('fs-extra');
const url = require('url');
const Vinyl = require('vinyl');
const path = require('path');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const {mapAsync} = require('../src/array');
const {read} = require('./helper');
const {FileNotFoundError} = require('../src/errors');
const {
  BASE_WARNING,
  isRemote,
  fileExists,
  joinPath,
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
} = require('../src/file');


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


test('Normalize paths', () => {
  const plattform = process.platform;
  Object.defineProperty(process, 'platform', {value: 'win32'});
  expect(normalizePath('foo\\bar')).toBe('foo/bar');
  Object.defineProperty(process, 'platform', {value: plattform});
});


test('Remote file detection', () => {
  const local = ['../test/foo.html', '/usr/tmp/bar'];
  const remote = ['https://test.io/', '//test.io/styles/main.css'];

  local.forEach(p => expect(isRemote(p)).toBe(false));
  remote.forEach(p => expect(isRemote(p)).toBe(true));
});


test("Error for file not found", () => {
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
    {base: `http://localhost:${port}/a/b/c/d.html`, part: 'test.html', expected: `http://localhost:${port}/a/b/c/test.html`},
    {base: `http://localhost:${port}/a/b/c/d.html`, part: '../test.html', expected: `http://localhost:${port}/a/b/test.html`},
  ];

  expect.assertions(tests.length);
  for (const {base, part, expected} of tests) {
    const result = joinPath(base, part);
    expect(result).toBe(expected);
  }
});

test('resolve', async () => {
  const tests = [
    {filepath: '/folder/subfolder/head.html', paths: [
      __dirname,
      path.join(__dirname, 'fixtures'),
      `http://localhost:${port}`,
    ], expected: path.join(__dirname, 'fixtures/folder/subfolder/head.html')},
    {filepath: '/folder/subfolder/head.html', paths: [
        __dirname,
        `http://localhost:${port}`,
        path.join(__dirname, 'fixtures/folder/subfolder/head.html'),
      ], expected: `http://localhost:${port}/folder/subfolder/head.html`},
    {filepath: '../styles/main.css', paths: [
        __dirname,
        `http://localhost:${port}`,
        `http://localhost:${port}/folder/`,
        path.join(__dirname, 'fixtures/folder/subfolder/head.html'),
      ], expected: `http://localhost:${port}/styles/main.css`},
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

  const contents = await Promise.all(files.map(f => fs.readFile(f)));
  const result = await Promise.all(files.map(filepath => vinylize({filepath})));

  expect.hasAssertions();
  expect(result.length).toBe(files.length);

  for (let i=0; i< result.length; i++) {
    expect(result[i].path).toBe(files[i]);
    expect(result[i].remote).toBe(false);
    expect(result[i].url).toBe(undefined);
    expect(result[i].urlObj).toBe(undefined);
    expect(result[i].contents.toString()).toBe(contents[i].toString());
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

  const contents = await Promise.all(files.map(f => fs.readFile(path.join(__dirname, f))));

  const urls = files.map(f => f.replace(/^fixtures/, `http://localhost:${port}`));
  const result = await Promise.all(urls.map(filepath => vinylize({filepath})));

 // expect.assertions(files.length * 4 + 1);
  expect(result.length).toBe(files.length);

  for (let i=0; i< result.length; i++) {
    expect(result[i].remote).toBe(true);
    expect(result[i].url).toBe(urls[i]);
    expect(result[i].urlObj).toEqual(url.parse(urls[i]));
    expect(result[i].contents.toString()).toBe(contents[i].toString());
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

  const vinyls = await Promise.all(files.map(f => vinylize({filepath: path.join(__dirname, f)})));
  const result = vinyls.map(v => getStylesheetHrefs(v));
  expect.assertions(files.length + 6);
  expect(result.length).toBe(5);
  result.forEach(stylesheets => expect(Array.isArray(stylesheets)).toBeTruthy());
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

  const vinyls = await Promise.all(files.map(f => vinylize({filepath: path.join(__dirname, f)})));
  const result = vinyls.map(v => getAssets(v));
  expect.assertions(files.length + 6);
  expect(result.length).toBe(5);
  result.forEach(assets => expect(Array.isArray(assets)).toBeTruthy());
  expect(result[0].length).toBe(0);
  expect(result[1].length).toBe(0);
  expect(result[2].length).toBe(5);
  expect(result[3].length).toBe(1);
  expect(result[4].length).toBe(0);
});

test('Compute document base (with base option)', async () => {
  const vinyls = await Promise.all([
    {filepath: `http://localhost:${port}/folder/generate-default.html`, expected: '/folder'},
    {filepath: `http://localhost:${port}/folder/head.html`, expected: '/folder'},
    {filepath: `http://localhost:${port}/generate-default.html`, expected: '/'},
    {filepath: `http://localhost:${port}/folder`, expected: '/'},
    {filepath: `http://localhost:${port}/folder/`, expected: '/folder'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder'},
    {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder'},
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder'},
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder'},
  ].map(f => vinylize(f).then(vinyl => ({...f, vinyl}))));

  const files = vinyls.map(data => {
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
  const vinyls = await Promise.all([
    {filepath: `http://localhost:${port}/folder`, expected: '/'},
    {filepath: `http://localhost:${port}/folder/`, expected: '/folder'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder'},
    {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder'},
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder'},
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder'},
  ].map(f => vinylize(f).then(vinyl => ({...f, vinyl}))));

  const files = vinyls.map(data => {
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
    {filepath: `http://localhost:${port}/folder`, expected: '/folder'},
    {filepath: `http://localhost:${port}/folder/`, expected: '/folder/index.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder/head.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder/generate-default.html'},
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/head.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder/relative.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder/relative.html'},
    {filepath: 'folder/relative.html', options: {base:  path.join(__dirname, 'fixtures')}, expected: '/folder/relative.html'},
    {filepath: vinyl, options: {base:  path.join(__dirname, 'fixtures')},expected: '/folder/relative.html'},
  ];

  expect.hasAssertions();
  for (const testdata of tests) {
    const {filepath, expected, options} = testdata;
    const file = await getDocument(filepath, options);
    expect(file.path).toBe(expected);
    if (testdata.noBase) {
       expect(stderr).toHaveBeenCalledWith(BASE_WARNING);
    }
  }
});

test('Get document from source with rebase option', async () => {
  const base = path.join(__dirname, 'fixtures');
  const tests = [
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/head.html'), expected: '/folder/subfolder/head.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/generate-default.html'), expected: '/folder/generate-default.html'},
    {filepath: path.join(__dirname, 'fixtures/head.html'), expected: '/head.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/subfolder/relative.html'), expected: '/folder/subfolder/relative.html'},
    {filepath: path.join(__dirname, 'fixtures/folder/relative.html'), expected: '/folder/relative.html'},
  ];

 // expect.assertions(tests.length + 1);
  for (const testdata of tests) {
    const {filepath, expected} = testdata;
    const rebase = {to: '/' + path.relative(base, filepath)};
    const source = await fs.readFile(filepath);
    const file = await getDocumentFromSource(source, {rebase, base});
    expect(file.path).toBe(expected);
  }

  expect(stderr).not.toHaveBeenCalled();
});

test('Get document from source without path options', async () => {
  const filepath = path.join(__dirname, 'fixtures/folder/subfolder/head.html');
  const source = await fs.readFile(filepath);
  const css = path.join(__dirname, 'fixtures/styles/image-relative.css');
  const file = await getDocumentFromSource(source, {css});
  const styles = await fs.readFile(css, 'utf8');

  //expect(file.path).toBe(undefined);
  expect(file.css).toMatch(styles);
  expect(stderr).toHaveBeenCalled();
});

test('Compute base for stylesheets', async () => {
  const docs = await mapAsync([
    `http://localhost:${port}/generate-image.html`,
    path.join(__dirname, 'fixtures/folder/generate-image.html'),
    `http://localhost:${port}/folder/relative-different.html`,
    path.join(__dirname, 'fixtures/relative-different.html'),
    path.join(__dirname, 'fixtures/remote-different.html'),
  ], async filepath => {
    const document = await vinylize({filepath});
    document.stylesheets = await getStylesheetHrefs(document);
    document.path = await getDocumentPath(document);
    return document;
  });

  const tests = [
    {filepath: `http://localhost:${port}/styles/image-relative.css`, expected: [
        '/styles/image-relative.css',
        `http://localhost:${port}/styles/image-relative.css`,
        `/styles/image-relative.css`,
        `http://localhost:${port}/styles/image-relative.css`,
        `http://localhost:${port}/styles/image-relative.css`,
    ]},
    {filepath: `http://127.0.0.1:${port}/styles/image-relative.css`, expected: [
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
        `http://127.0.0.1:${port}/styles/image-relative.css`,
    ]},
    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), expected: [
      '/styles/image-relative.css',
      '/styles/image-relative.css',
      '/folder/styles/image-relative.css',
      '/styles/image-relative.css',
      'http://www.cdn.somewhere/styles/image-relative.css',
    ]},
  ];

  expect.assertions(docs.length * tests.length);

  for (let index = 0; index < docs.length; index++) {
    const document = docs[index];
    for (const testdata of tests) {
      const {filepath, expected} = testdata;
      const file = await vinylize({filepath});
      const result = await getStylesheetPath(document, file);

      expect(result).toBe(expected[index]);

    }
  }
});


test('Get styles', async () => {
  const docs = await mapAsync([
    `http://localhost:${port}/generate-image.html`,
    path.join(__dirname, 'fixtures/folder/generate-image.html'),
  ], async filepath => getDocument(filepath));

  const tests = [
    {filepath: `http://localhost:${port}/styles/image-relative.css`, expected: [
      'images/critical.png',
      `http://localhost:${port}/images/critical.png`,
    ]},
    {filepath: `http://localhost:${port}/folder/subfolder/issue-216.css`, expected: [
        `folder/fonts/fontawesome-webfont.woff`,
        `http://localhost:${port}/folder/fonts/fontawesome-webfont.woff`,
      ]},
    {filepath: `http://127.0.0.1:${port}/styles/image-relative.css`, expected: [
      `http://127.0.0.1:${port}/images/critical.png`,
      `http://127.0.0.1:${port}/images/critical.png`,
    ]},
    {filepath: `http://127.0.0.1:${port}/folder/subfolder/issue-216.css`, expected: [
        `http://127.0.0.1:${port}/folder/fonts/fontawesome-webfont.woff`,
        `http://127.0.0.1:${port}/folder/fonts/fontawesome-webfont.woff`,
      ]},
    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), expected: [
      'images/critical.png',
      '../images/critical.png',
    ]},
    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), options: {rebase: {from:'/styles/main.css', to:'/index.html'}}, expected: [
      'images/critical.png',
      'images/critical.png',
    ]},
    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), options: {rebase: {from:'/styles/main.css', to:'/a/b/c/index.html'}}, expected: [
      '../../../images/critical.png',
      '../../../images/critical.png',
    ]},

    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), options: {rebase: asset => `https://my-cdn.com${asset.absolutePath}`}, expected: [
      'https://my-cdn.com/images/critical.png',
      'https://my-cdn.com/images/critical.png',
    ]},
  ];

  for (let index = 0; index < docs.length; index++) {
    const document = docs[index];
    for (const testdata of tests) {
      const {filepath, expected, options = {}} = testdata;
      const file = await getStylesheet(document, filepath, {base: path.join(__dirname, 'fixtures'), ...options || {}});
      expect(file.contents.toString()).toMatch(expected[index]);
    }
  }
});

test('Get styles (without path)', async () => {
  const docs = await mapAsync([
    path.join(__dirname, 'fixtures/folder/generate-image.html'),
    path.join(__dirname, 'fixtures/relative-different.html'),
    path.join(__dirname, 'fixtures/remote-different.html'),
  ], async file => fs.readFile(file));

  const tests = [
    {filepath: `http://localhost:${port}/styles/image-relative.css`, expected: [
        `http://localhost:${port}/images/critical.png`,
        `http://localhost:${port}/images/critical.png`,
        `http://localhost:${port}/images/critical.png`,
      ]},
    {filepath: `http://127.0.0.1:${port}/styles/image-relative.css`, expected: [
        `http://127.0.0.1:${port}/images/critical.png`,
        `http://127.0.0.1:${port}/images/critical.png`,
        `http://127.0.0.1:${port}/images/critical.png`,
      ]},
    {filepath: path.join(__dirname, 'fixtures/styles/image-relative.css'), expected: [
        `'/images/critical.png'`,
        `'/images/critical.png'`,
        `'/images/critical.png'`,
      ]},
  ];

  for (let index = 0; index < docs.length; index++) {
    for (const testdata of tests) {
      const {filepath, expected} = testdata;
      const document = await getDocumentFromSource(docs[index], {css: filepath});
      const file = await getStylesheet(document, filepath, {base: path.join(__dirname, 'fixtures')});
      expect(file.contents.toString()).toMatch(expected[index]);

    }
  }
});



