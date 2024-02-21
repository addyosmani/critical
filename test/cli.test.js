import {exec, execFile} from 'node:child_process';
// import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {globby} from 'globby';
import {jest} from '@jest/globals';
import nn from 'normalize-newline';
import {read, getPkg} from './helper/index.js';

jest.setTimeout(100_000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const require = createRequire(import.meta.url);

const {version, bin} = getPkg();

jest.unstable_mockModule('../index.js', () => ({
  generate: jest.fn(),
  stream: jest.fn(),
}));

const criticalBin = path.join(__dirname, '..', bin);

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

const pExec = promisify(exec);
const pExecFile = promisify(execFile);

const run = async (args = []) => pExecFile('node', [criticalBin, ...args]);

const getArgs = async (params = []) => {
  const origArgv = process.argv;
  process.argv = ['node', criticalBin, ...params];

  await import('../cli.js');
  process.argv = origArgv;
  const {generate} = await import('../index.js');
  const [args] = generate.mock.calls;
  const [opts] = args || [{}];
  expect(generate).toHaveBeenCalledTimes(1);
  return opts || {};
};

const pipe = async (filename, args = []) => {
  const cat = process.platform === 'win32' ? 'type' : 'cat';
  const cmd = `${cat} ${filename} | node ${criticalBin} ${args.join(' ')}`;
  return pExec(cmd, {shell: true});
};

describe('CLI', () => {
  describe('acceptance', () => {
    test('Show error alongside help', async () => {
      expect.assertions(3);
      try {
        await run(['not available']);
      } catch (error) {
        expect(error.stderr).toMatch('Error:');
        expect(error.stderr).toMatch('Usage: critical');
        expect(error.code).toBe(1);
      }
    });

    test('Return version', async () => {
      const {stdout, stderr} = await run(['--version']);

      expect(stderr).toBeFalsy();
      expect(stdout.trim()).toBe(version);
    });

    test('Take html file passed via parameter', async () => {
      const {stdout, stderr} = await run([
        'fixtures/generate-default.html',
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-default.css');

      expect(stderr).toBeFalsy();
      expect(nn(stdout)).toBe(expected);
    });

    test('Take html file piped to critical', async () => {
      const {stdout, stderr} = await pipe(path.normalize('fixtures/generate-default.html'), [
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-default.css');

      expect(stderr).toMatch('Not rebasing assets for');
      expect(stderr.code).toBeUndefined();
      expect(nn(stdout)).toBe(expected);
    });

    test('Pipe html file inside a folder to critical', async () => {
      const {stdout, stderr} = await pipe(path.normalize('fixtures/folder/generate-default.html'), [
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-default.css');

      expect(stderr).toMatch('Not rebasing assets for');
      expect(stderr.code).toBeUndefined();
      expect(nn(stdout)).toBe(expected);
    });

    test('Inline images to piped html file', async () => {
      const {stdout, stderr} = await pipe(path.normalize('fixtures/generate-image.html'), [
        '-c',
        'fixtures/styles/image-relative.css',
        '--inlineImages',
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-image.css');

      expect(stderr).toBeFalsy();
      expect(nn(stdout)).toBe(expected);
    });

    test("Add an absolute image path to critical css if we can't determine document location", async () => {
      const {stdout, stderr} = await pipe(path.normalize('fixtures/folder/generate-image.html'), [
        '-c',
        'fixtures/styles/image-relative.css',
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-image-absolute.css');

      expect(stderr).toBeFalsy();
      expect(nn(stdout)).toBe(expected);
    });

    test('Add absolute image paths on piped html without relative links', async () => {
      const {stdout, stderr} = await pipe(path.normalize('fixtures/folder/subfolder/generate-image-absolute.html'), [
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-image-absolute.css');

      expect(stderr).toBeFalsy();
      expect(nn(stdout)).toBe(expected);
    });

    test('Exit with code 1 and show help', async () => {
      expect.assertions(2);
      try {
        await run(['fixtures/not-exists.html']);
      } catch (error) {
        expect(error.code).toBe(1);
        expect(error.stderr).toMatch('Usage:');
      }
    });

    test('Generate multi-dimension critical-path CSS using cli', async () => {
      const {stdout} = await pipe(path.normalize('fixtures/generate-adaptive.html'), [
        '--base',
        'fixtures',
        '--dimensions',
        '100x70',
        '--dimensions',
        '1000x70',
      ]);
      const expected = await read('expected/generate-adaptive.css', 'utf8');
      expect(nn(stdout)).toBe(expected);
    });
  });

  let exit;
  describe('mocked', () => {
    beforeEach(() => {
      jest.resetModules();
      exit = process.exit;
    });

    afterEach(() => {
      process.exit = exit;
    });

    test('pass the correct opts when using short opts', async () => {
      const args = await getArgs(['fixtures/generate-default.html', '-c', 'css', '-w', '300', '-h', '400', '-e', '-i']);

      expect(args).toMatchObject({
        width: 300,
        height: 400,
        css: ['css'],
        inline: true,
        extract: true,
      });
    });

    test('pass the correct opts when using long opts', async () => {
      const args = await getArgs([
        'fixtures/generate-default.html',
        '--css',
        'css',
        '--width',
        '300',
        '--height',
        '400',
        '--ignore',
        'ignore',
        '--include',
        '/include/',
        '--inline',
        '--extract',
        '--inlineImages',
        '1024',
        '--assetPaths',
        'assetPath1',
        '--assetPaths',
        'assetPath2',
        '--dimensions',
        '1300x800',
        '--dimensions',
        '640x480',
        '--dimensions',
        '1x2,3x4,5x6',
      ]);

      expect(args).toMatchObject({
        width: 300,
        height: 400,
        css: ['css'],
        inline: true,
        extract: true,
        dimensions: [
          {width: 1300, height: 800},
          {width: 640, height: 480},
          {width: 1, height: 2},
          {width: 3, height: 4},
          {width: 5, height: 6},
        ],
      });
    });

    test('Set inline to false when prefixed with --no', async () => {
      const args = await getArgs(['fixtures/generate-default.html', '--no-inline']);

      expect(args).toMatchObject({
        inline: false,
      });
    });

    test('Set penthouse options prefixed with --penthouse-', async () => {
      const args = await getArgs([
        'fixtures/generate-default.html',
        '--penthouse-strict',
        '--penthouse-timeout',
        '50000',
        '--penthouse-renderWaitTime',
        '300',
      ]);

      expect(args).toMatchObject({
        penthouse: {
          strict: true,
          timeout: 50_000,
          renderWaitTime: 300,
        },
      });
    });

    test('Set request options prefixed with --request-', async () => {
      const args = await getArgs([
        'fixtures/generate-default.html',
        '--request-method',
        'get',
        '--no-request-followRedirect',
      ]);

      expect(args).toMatchObject({
        request: {
          method: 'get',
          followRedirect: false,
        },
      });
    });

    test('Handle shell expanded the glob', async () => {
      // simulate system glob
      const css = await globby('fixtures/**/*.css');
      const args = await getArgs(['fixtures/generate-default.html', '-c', ...css, '--target', 'test.css']);

      expect(args).toMatchObject({
        css,
        target: 'test.css',
        src: 'fixtures/generate-default.html',
      });
    });

    test('Handle glob', async () => {
      // simulate system glob
      const args = await getArgs(['fixtures/generate-default.html', '-c', 'fixtures/**/*.css', '--target', 'test.css']);

      expect(args).toMatchObject({
        css: ['fixtures/**/*.css'],
        target: 'test.css',
        src: 'fixtures/generate-default.html',
      });
    });
  });
});
