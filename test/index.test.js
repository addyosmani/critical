const path = require('path');
const fs = require('fs-extra');
const vinylStream = require('vinyl-source-stream');
const Vinyl = require('vinyl');
const PluginError = require('plugin-error');
const nn = require('normalize-newline');
const streamAssert = require('stream-assert');
const {ConfigError, FileNotFoundError, NoCssError} = require('../src/errors');
const {getVinyl, readAndRemove, read} = require('./helper');
const {generate, stream} = require('../index');

jest.setTimeout(20000);

test('Handle errors with passed callback method', done => {
  const tmp = generate({}, (error, data) => {
    expect(data).toBeFalsy();
    expect(error).toBeInstanceOf(Error);
    done();
  });

  expect(tmp).resolves.toBeUndefined();
});

test('Call callback function with object containing html & css props', done => {
  generate({src: path.join(__dirname, 'fixtures/generate-default.html')}, (error, data) => {
    expect(error).toBeFalsy();
    expect(data).toHaveProperty('css');
    expect(data).toHaveProperty('html');
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

test('Write both targets', async () => {
  const data = await generate({src: path.join(__dirname, 'fixtures/generate-default.html'), target: {html:'.test.html', css:'.test.css'}});
  expect(data).toHaveProperty('css');
  expect(data).toHaveProperty('html');
  expect(fs.existsSync('.test.css')).toBeTruthy();
  expect(fs.existsSync('.test.html')).toBeTruthy();

  const html = readAndRemove('.test.html');
  const css = readAndRemove('.test.css');
  expect(html).toBe(data.html);
  expect(css).toBe(data.css);
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

test('Emit error on streamed file', done => {
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

test('Throws PluginError on critical.stream error', done => {
  const critical = stream({invalidOption: true});

  getVinyl('error.html')
    .pipe(critical)
    .on('data', () => done.fail(new Error('Should not emit data')))
    .on('error',  (error) => {
      expect(error).toBeInstanceOf(PluginError);
      expect(error.plugin).toBe('critical');
      done();
    });
});

test('Support vinyl buffer streams and return critical css vinyl', done => {
  const critical = stream({base: path.join(__dirname, 'fixtures')});

  getVinyl('generate-default.html')
    .pipe(critical)
    .on('data', data => {
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

test('Support vinyl buffer streams and returns html vinyl with inlined css', done => {
  const critical = stream({base: path.join(__dirname, 'fixtures'), inline: true});

  getVinyl('generate-default.html')
    .pipe(critical)
    .on('data', data => {
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

test('Return empty vinyl on empty vinyl', done => {
  const critical = stream({base: path.join(__dirname, 'fixtures')});

  getVinyl(false)
    .pipe(critical)
    .on('data', data => {
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

test('#192 - include option - stream', done => {
  const critical = stream({
      base: path.join(__dirname, 'fixtures'),
      css: ['fixtures/styles/issue-192.css'],
      minify: true,
      extract: false,
      ignore: ['@font-face', /url\(/],
      dimensions: [{
          width: 320,
          height: 480
      }, {
          width: 768,
          height: 1024
      }, {
          width: 1280,
          height: 960
      }, {
          width: 1920,
          height: 1080
      }],
      include: [/^\.main-navigation.*$/,
          /^\.hero-deck.*$/,
          /^\.deck.*$/,
          /^\.search-box.*$/],
      width: 1300,
      height: 900
  });

  const expected = read('expected/issue-192.css');

  getVinyl('issue-192.html')
      .pipe(critical)
      .pipe(streamAssert.length(1))
      .pipe(streamAssert.nth(0, d => {
          expect(path.extname(d.path)).toBe('.css');
          expect(nn(d.contents.toString('utf8'))).toBe(expected);
      }))
      .pipe(streamAssert.end(done));
});

test.skip('should generate multi-dimension critical-path CSS in stream mode', done => {
  const expected = read('expected/generate-adaptive.css', 'utf8');

  const critical = stream({
      base: 'fixtures/',
      dimensions: [{
          width: 100,
          height: 70
      }, {
          width: 1000,
          height: 70
      }]
  });

  getVinyl('generate-adaptive.html')
      .pipe(critical)
      .pipe(streamAssert.length(1))
      .pipe(streamAssert.nth(0, d => {
        expect(path.extname(d.path)).toBe('.css');
        expect(nn(d.contents.toString('utf8'))).toBe(expected);
      }))
      .pipe(streamAssert.end(done));
});