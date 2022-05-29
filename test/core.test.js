import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {join, dirname} from 'node:path';
import {jest} from '@jest/globals';
import getPort from 'get-port';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import {create} from '../src/core.js';
import {read} from './helper/index.js';

jest.useFakeTimers();
jest.setTimeout(20_000);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Set up static fileserver to mimic remote requests
let server;
let port;
beforeAll(async () => {
  const root = join(__dirname, 'fixtures');
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
    const result = await create({
      src: `http://localhost:${port}/generate-default.html`,
    });
    expect(result.css).toBe(css);
    expect(result.html).toBe(html);
  } catch (error) {
    expect(error).toBe(undefined);
  }
});
