import process from 'node:process';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {jest} from '@jest/globals';
import finalhandler from 'finalhandler';
import getPort from 'get-port';
import serveStatic from 'serve-static';
import CleanCSS from 'clean-css';
import {create} from '../src/core.js';
import {read} from './helper/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
jest.setTimeout(100_000);

// Set up static fileserver to mimic remote requests
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
    const result = await create({
      src: `http://localhost:${port}/generate-default.html`,
    });

    expect(result.css).toBe(css);
    expect(result.html).toBe(html);
  } catch (error) {
    expect(error).toBe(undefined);
  }
});

test('Generate critical-path CSS with custom cleancss config', async () => {
  const css = read('fixtures/styles/issue-562.css');
  const html = read('fixtures/issue-562.html');

  const optionsArray = [
    {
      level: 2,
      format: 'beautify',
    },
    {
      level: 1,
    },
  ];

  for (const options of optionsArray) {
    const expected = new CleanCSS(options).minify(css).styles;

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await create({
        src: `http://localhost:${port}/issue-562.html`,
        cleanCSS: options,
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
      });

      expect(result.css).toBe(expected);
      expect(result.html).toBe(html);
    } catch (error) {
      expect(error).toBe(undefined);
    }
  }
});

test('Generate critical-path CSS with modern CSS features', async () => {
  const css = read('expected/modern-css-features.css');
  const html = read('fixtures/modern-css-features.html');

  try {
    const result = await create({
      src: `http://localhost:${port}/modern-css-features.html`,
      width: 1300,
      height: 900,
    });

    // Verify modern CSS features are preserved
    expect(result.css).toContain('@container');
    expect(result.css).toContain('@layer');
    expect(result.css).toContain(':where');
    expect(result.css).toContain(':has');
    expect(result.css).toBe(css);
    expect(result.html).toBe(html);
  } catch (error) {
    expect(error).toBe(undefined);
  }
});

test('Generate critical-path CSS with lazy loaded iframes (issue #615)', async () => {
  const css = read('expected/lazy-iframe.css');

  try {
    const result = await create({
      src: `http://localhost:${port}/lazy-iframe.html`,
      width: 1300,
      height: 900,
    });

    // Should not time out and should generate valid CSS
    expect(result.css).toBeDefined();
    expect(result.css.length).toBeGreaterThan(0);
    expect(result.css).toBe(css);
  } catch (error) {
    expect(error).toBe(undefined);
  }
});
