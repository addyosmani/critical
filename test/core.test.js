/* eslint-env jest node */
const path = require('path');
const {createServer} = require('http');
const getPort = require('get-port');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const {create} = require('../src/core');
const {read} = require('./helper');

jest.setTimeout(20000);

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


test('Generate critical-path CSS', async () => {
  const css = read('expected/generate-default.css');
  const html = read('fixtures/generate-default.html');


  try {
    const result =  await create({
      src:  `http://localhost:${port}/generate-default.html`,
      minify: true,
    });
    expect(result.css).toBe(css);
    expect(result.html).toBe(html);
  } catch (error) {
    expect(error).toBe(undefined);
  }
});
