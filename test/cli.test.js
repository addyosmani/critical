const path = require('path');
const readPkgUp = require('read-pkg-up');
const execa = require('execa');
const nn = require('normalize-newline');
const globby = require('globby');
const {read} = require('./helper');

process.chdir(path.resolve(__dirname));
process.setMaxListeners(0);

jest.setTimeout(60000);

const getBin = async () => {
  const {pkg} = await readPkgUp();
  return path.join(__dirname, '../', pkg.bin.critical);
};

const run = async (args = []) => {
  const bin = await getBin();
  return execa('node', [bin, ...args]);
};

const getArgs = async (params = []) => {
  const bin = await getBin();
  const origArgv = process.argv;
  const critical = require('..');

  critical.generate = jest.fn();
  process.argv = ['node', bin, ...params];

  require('../cli'); // eslint-disable-line import/no-unassigned-import
  process.argv = origArgv;
  const [args] = critical.generate.mock.calls;
  const [opts] = args || [{}];
  expect(critical.generate).toHaveBeenCalledTimes(1);
  return opts || {};
};

const pipe = async (filename, args = []) => {
  const cat = process.platform === 'win32' ? 'type' : 'cat';
  const bin = await getBin();
  const cmd = `${cat} ${filename} | node ${bin} ${args.join(' ')}`;
  return execa.shell(cmd);
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
        expect(error.code).not.toBe(0);
      }
    });

    test('Return version', async () => {
      const {pkg} = await readPkgUp();
      const {stdout, stderr, code} = await run(['--version', '--no-update-notifier']);

      expect(stderr).toBeFalsy();
      expect(code).toBe(0);
      expect(stdout).toBe(pkg.version);
    });

    test('Take html file passed via parameter', async () => {
      const {stdout, code} = await run([
        'fixtures/generate-default.html',
        '--base',
        'fixtures',
        '--width',
        '1300',
        '--height',
        '900',
      ]);
      const expected = await read('expected/generate-default.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Take html file piped to critical', async () => {
      const {stdout, code} = await pipe(
        path.normalize('fixtures/generate-default.html'),
        ['--base', 'fixtures', '--width', '1300', '--height', '900']
      );
      const expected = await read('expected/generate-default.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Pipe html file inside a folder to critical', async () => {
      const {stdout, code} = await pipe(
        path.normalize('fixtures/folder/generate-default.html'),
        ['--base', 'fixtures', '--width', '1300', '--height', '900']
      );
      const expected = await read('expected/generate-default.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Inline images to piped html file', async () => {
      const {stdout, code} = await pipe(
        path.normalize('fixtures/generate-image.html'),
        [
          '-c',
          'fixtures/styles/image-relative.css',
          '--inlineImages',
          '--base',
          'fixtures',
          '--width',
          '1300',
          '--height',
          '900',
        ]
      );
      const expected = await read('expected/generate-image.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test("Add an absolute image path to critical css if we can't determine document location", async () => {
      const {stdout, code} = await pipe(
        path.normalize('fixtures/folder/generate-image.html'),
        ['-c', 'fixtures/styles/image-relative.css', '--base', 'fixtures', '--width', '1300', '--height', '900']
      );
      const expected = await read('expected/generate-image-absolute.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Add absolute image paths on piped html without relative links', async () => {
      const {stdout, code} = await pipe(
        path.normalize('fixtures/folder/subfolder/generate-image-absolute.html'),
        ['--base', 'fixtures', '--width', '1300', '--height', '900']
      );
      const expected = await read('expected/generate-image-absolute.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Exit with code 1 and show help', async () => {
      await expect(run(['fixtures/not-exists.html'])).rejects.toThrow('Usage:');
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
      ]);

      expect(args).toMatchObject({
        width: 300,
        height: 400,
        css: ['css'],
        inline: true,
        extract: true,
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
          timeout: 50000,
          renderWaitTime: 300,
        },
      });
    });

    test('Set got options prefixed with --got-', async () => {
      const args = await getArgs(['fixtures/generate-default.html', '--got-method', 'get', '--no-got-followRedirect']);

      expect(args).toMatchObject({
        got: {
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
