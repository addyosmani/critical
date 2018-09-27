/* eslint-env jest node */
const {ConfigError} = require('../src/errors');
const {getOptions, DEFAULT} = require('../src/config');

test('Throws ConfigError on invalid config', () => {
  expect(() => {
    getOptions({invalidParam: true});
  }).toThrow(ConfigError);
});

test('Throws ConfigError on missing param', () => {
  expect(() => {
    getOptions({});
  }).toThrow(ConfigError);
});

test('Throws ConfigError when html & src are both set', () => {
  expect(() => {
    getOptions({html: '...', src: '...'});
  }).toThrow(ConfigError);
});

test('Throws ConfigError on empty required value', () => {
  expect(() => {
    getOptions({src: ''});
  }).toThrow(ConfigError);
});

test('Returns config object', () => {
  const config = getOptions({src:'...'});
  expect(config).toMatchObject({
    src: '...',
    width: DEFAULT.width,
    height: DEFAULT.height,
    maxImageFileSize: DEFAULT.maxImageFileSize,
    minify: DEFAULT.minify,
    strict: DEFAULT.strict,
    extract: DEFAULT.extract,
    concurrency: DEFAULT.concurrency,
    inlineImages: DEFAULT.inlineImages,
    include: DEFAULT.include,
    inline: DEFAULT.inline,
    dimensions: [{width: DEFAULT.width, height: DEFAULT.height}],
    penthouse: {
      forceInclude: DEFAULT.include,
      timeout: DEFAULT.timeout,
      maxEmbeddedBase64Length: DEFAULT.maxImageFileSize,
    },
  });
});

test('Target config on passed string', () => {
  expect(getOptions({src:'...', target: 'test.css'})).toHaveProperty('target', {css: 'test.css'});
  expect(getOptions({src:'...', target: 'test.html'})).toHaveProperty('target', {html: 'test.html'});
});

test('Inline config on passed boolean', () => {
  expect(getOptions({src:'...', inline: true, base: 'BASE'})).toHaveProperty('inline', {
    minify: DEFAULT.minify,
    extract: DEFAULT.extract,
    basePath: 'BASE',
  });
});

test('Inline config on passed object', () => {
  expect(getOptions({src:'...', inline: {check: true}, base: 'BASE'})).toHaveProperty('inline', {
    minify: DEFAULT.minify,
    extract: DEFAULT.extract,
    basePath: 'BASE',
    check: true,
  });
});

test('Penthouse config on passed object', () => {
  expect(getOptions({src:'...', penthouse: {check: true}})).toHaveProperty('penthouse', {
    forceInclude: DEFAULT.include,
    timeout: DEFAULT.timeout,
    maxEmbeddedBase64Length: DEFAULT.maxImageFileSize,
    check: true,
  });
});

test('Ignore config on passed array', () => {
  expect(getOptions({src:'...', ignore: ['@font-face']})).toHaveProperty('ignore', {
    atrule: ['@font-face'],
    rule: ['@font-face'],
    decl: ["@font-face"],
  });
});
