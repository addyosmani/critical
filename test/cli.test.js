/* eslint-env jest node */
const path = require('path');
const readPkgUp = require('read-pkg-up');
const execa = require('execa');
const nn = require('normalize-newline');
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
  return execa('node', [bin, ...args])
};

const pipe = async (filename, args = []) => {
  const cat = process.platform === 'win32' ? 'type' : 'cat';
  const bin = await getBin();
  const cmd = `${cat} ${filename} | node ${bin} ${args.join(' ')}`;
  return execa.shell(cmd);
};



describe('CLI', () => {

  describe('acceptance', () => {

    test('Return version', async () => {
      const {pkg} = await readPkgUp();
      const {stdout, stderr, code} = await run(['--version', '--no-update-notifier']);

      expect(stderr).toBeFalsy();
      expect(code).toBe(0);
      expect(stdout).toBe(pkg.version);
    });

    test('Take html file passed via parameter', async () => {
      const {stdout, code} = await run(['fixtures/generate-default.html', '--base', 'fixtures', '--width', '1300', '--height', '900']);
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
        ['-c', 'fixtures/styles/image-relative.css', '--inlineImages', '--base', 'fixtures', '--width', '1300', '--height', '900']
      );
      const expected = await read('expected/generate-image.css');

      expect(code).toBe(0);
      expect(nn(stdout)).toBe(expected);
    });

    test('Add an absolute image path to critical css if we can\'t determine document location', async () => {
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

  // describe('acceptance (remote)', () => {
    //   let serverport;
    //
    //   beforeEach(() => {
    //     const serve = serveStatic('fixtures', {index: ['generate-default.html']});
    //
    //     this.server = http.createServer((req, res) => {
    //       const done = finalhandler(req, res);
    //       serve(req, res, done);
    //     });
    //
    //     return getPort().then(port => {
    //       this.server.listen(port);
    //       serverport = port;
    //     });
    //   });
    //
    //   afterEach(() => {
    //     this.server.close();
    //     process.emit('cleanup');
    //   });
    //
    //   it('should generate critical path css from external resource', function (done) {
    //     const cp = execFile('node', [
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       `http://localhost:${serverport}`,
    //       '--base',
    //       'fixtures',
    //       '--width',
    //       '1300',
    //       '--height',
    //       '900'
    //     ]);
    //
    //     const expected = fs.readFileSync(path.join(__dirname, 'expected/generate-default.css'), 'utf8');
    //     cp.stdout.on('data', data => {
    //       if (data instanceof Buffer) {
    //         data = data.toString('utf8');
    //       }
    //       assert.strictEqual(nn(data), nn(expected));
    //       done();
    //     });
    //   });
    //
    //   it('should generate critical path css with external stylesheets passed as option', function (done) {
    //     const cp = execFile('node', [
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       `http://localhost:${serverport}`,
    //       '--css',
    //       `http://localhost:${serverport}/styles/main.css`,
    //       '--css',
    //       `http://localhost:${serverport}/styles/bootstrap.css`,
    //       '--base',
    //       'fixtures',
    //       '--width',
    //       '1300',
    //       '--height',
    //       '900'
    //     ]);
    //
    //     const expected = fs.readFileSync(path.join(__dirname, 'expected/generate-default.css'), 'utf8');
    //     cp.stdout.on('data', data => {
    //       if (data instanceof Buffer) {
    //         data = data.toString('utf8');
    //       }
    //       assert.strictEqual(nn(data), nn(expected));
    //       done();
    //     });
    //   });
    // });
    //
    // describe('mocked', () => {
    //   beforeEach(function () {
    //     this.origArgv = process.argv;
    //     this.origExit = process.exit;
    //
    //     mockery.enable({
    //       warnOnUnregistered: false,
    //       useCleanCache: true
    //     });
    //
    //     mockery.registerMock('.', {
    //       generate: opts => {
    //         this.mockOpts = opts;
    //         this.method = 'generate';
    //       }
    //     });
    //   });
    //
    //   afterEach(function () {
    //     mockery.deregisterAll();
    //     mockery.disable();
    //     process.argv = this.origArgv;
    //     process.exit = this.origExit;
    //   });
    //
    //   it('should pass the correct opts when using short opts', function () {
    //     process.argv = [
    //       'node',
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       'fixtures/generate-default.html',
    //       '-c',
    //       'css',
    //       '-w',
    //       '300',
    //       '-h',
    //       '400',
    //       '-e',
    //       '-i'
    //     ];
    //
    //     require('../cli'); // eslint-disable-line import/no-unassigned-import
    //
    //     assert.strictEqual(this.mockOpts.width, 300);
    //     assert.strictEqual(this.mockOpts.height, 400);
    //     assert.strictEqual(this.mockOpts.css, 'css');
    //     assert.strictEqual(this.mockOpts.inline, true);
    //     assert.strictEqual(this.mockOpts.extract, true);
    //   });
    //
    //   it('should pass the correct opts when using long opts', function () {
    //     process.argv = [
    //       'node',
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       'fixtures/generate-default.html',
    //       '--css',
    //       'css',
    //       '--width',
    //       '300',
    //       '--height',
    //       '400',
    //       '--ignore',
    //       'ignore',
    //       '--include',
    //       '/include/',
    //       '--inline',
    //       '--extract',
    //       '--inlineImages',
    //       '--maxFileSize',
    //       '1024',
    //       '--assetPaths',
    //       'assetPath1',
    //       '--assetPaths',
    //       'assetPath2'
    //     ];
    //
    //     require('../cli'); // eslint-disable-line import/no-unassigned-import
    //
    //     assert.strictEqual(this.mockOpts.width, 300);
    //     assert.strictEqual(this.mockOpts.height, 400);
    //     assert.strictEqual(this.mockOpts.css, 'css');
    //     assert.strictEqual(this.mockOpts.extract, true);
    //     assert.isArray(this.mockOpts.ignore);
    //     assert.include(this.mockOpts.ignore, 'ignore');
    //     assert.isArray(this.mockOpts.include);
    //     assert.instanceOf(this.mockOpts.include[0], RegExp);
    //     assert.strictEqual(Boolean(this.mockOpts.inline), true);
    //     assert.strictEqual(this.mockOpts.inlineImages, true);
    //     assert.isArray(this.mockOpts.assetPaths);
    //     assert.include(this.mockOpts.assetPaths, 'assetPath1');
    //     assert.include(this.mockOpts.assetPaths, 'assetPath2');
    //     assert.strictEqual(this.mockOpts.maxFileSize, 1024);
    //   });
    //
    //   it('should set inline to false when prefixed with --no', function () {
    //     process.argv = [
    //       'node',
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       'fixtures/generate-default.html',
    //       '--no-inline'
    //     ];
    //
    //     require('../cli'); // eslint-disable-line import/no-unassigned-import
    //
    //     assert.strictEqual(this.mockOpts.inline, false);
    //   });
    //
    //   it('should set penthouse options prefixed with --penthouse-', function () {
    //     process.argv = [
    //       'node',
    //       path.join(__dirname, '../', this.pkg.bin.critical),
    //       'fixtures/generate-default.html',
    //       '--penthouse-strict',
    //       '--penthouse-timeout',
    //       '50000',
    //       '--penthouse-renderWaitTime',
    //       '300'
    //     ];
    //
    //     require('../cli'); // eslint-disable-line import/no-unassigned-import
    //
    //     assert.strictEqual(this.mockOpts.penthouse.strict, true);
    //     assert.strictEqual(this.mockOpts.penthouse.timeout, 50000);
    //     assert.strictEqual(this.mockOpts.penthouse.renderWaitTime, 300);
    //   });
    // });
  // });
});
