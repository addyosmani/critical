import {ConfigError} from '../src/errors.js';
import {getOptions, DEFAULT} from '../src/config.js';

test('Throws ConfigError on invalid config', () => {
  expect(async () => {
    await getOptions({invalidParam: true});
  }).rejects.toThrow(ConfigError);
});

test('Throws ConfigError on missing param', async () => {
  expect(async () => {
    await getOptions({});
  }).rejects.toThrow(ConfigError);
});

test('Throws ConfigError when html & src are both set', async () => {
  expect(async () => {
    await getOptions({html: '...', src: '...'});
  }).rejects.toThrow(ConfigError);
});

test('Throws ConfigError on empty required value', async () => {
  expect(async () => {
    await getOptions({src: ''});
  }).rejects.toThrow(ConfigError);
});

test('Returns config object', async () => {
  const config = await getOptions({src: '...'});
  expect(config).toMatchObject({
    src: '...',
    width: DEFAULT.width,
    height: DEFAULT.height,
    maxImageFileSize: DEFAULT.maxImageFileSize,
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

test('Target config on passed string', async () => {
  expect(await getOptions({src: '...', target: 'test.css'})).toHaveProperty('target', {css: 'test.css'});
  expect(await getOptions({src: '...', target: 'test.html'})).toHaveProperty('target', {html: 'test.html'});
});

test('Inline config on passed boolean', async () => {
  expect(await getOptions({src: '...', inline: true, base: 'BASE'})).toHaveProperty('inline', {
    basePath: 'BASE',
    strategy: 'media',
  });
});

test('Inline config on passed object', async () => {
  expect(await getOptions({src: '...', inline: {check: true}, base: 'BASE'})).toHaveProperty('inline', {
    basePath: 'BASE',
    check: true,
  });
});

test('Penthouse config on passed object', async () => {
  expect(await getOptions({src: '...', penthouse: {check: true}})).toHaveProperty('penthouse', {
    forceInclude: DEFAULT.include,
    timeout: DEFAULT.timeout,
    maxEmbeddedBase64Length: DEFAULT.maxImageFileSize,
    check: true,
  });
});

test('Ignore config on passed array', async () => {
  expect(await getOptions({src: '...', ignore: ['@font-face']})).toHaveProperty('ignore', {
    atrule: ['@font-face'],
    rule: ['@font-face'],
    decl: ['@font-face'],
  });
});

test('Parses config values passed as JSON string', async () => {
  const headers = {cookie: 'key=value'};
  expect(await getOptions({src: '...', request: {headers: JSON.stringify(headers)}})).toHaveProperty('request', {
    headers,
  });
});
