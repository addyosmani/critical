const Joi = require('joi');
const {ConfigError} = require('./errors');

const DEFAULT = {
  width: 1300,
  height: 900,
  timeout: 30000,
  maxImageFileSize: 10240,
  minify: true,
  inline: false,
  strict: false,
  extract: false,
  inlineImages: false,
  concurrency: Infinity,
  include: [],
};

const schema = Joi.object()
  .keys({
    html: Joi.string(),
    src: [Joi.string(), Joi.object()],
    css: [Joi.string(), Joi.array()],
    base: Joi.string(),
    strict: Joi.boolean().default(DEFAULT.strict),
    extract: Joi.boolean().default(DEFAULT.extract),
    inlineImages: Joi.boolean().default(DEFAULT.inlineImages),
    postcss: Joi.array(),
    ignore: Joi.array(),
    width: Joi.number().default(DEFAULT.width),
    height: Joi.number().default(DEFAULT.height),
    minify: Joi.boolean().default(DEFAULT.minify),
    dimensions: Joi.array().items({width: Joi.number(), height: Joi.number()}),
    inline: [Joi.boolean().default(DEFAULT.inline), Joi.object().unknown(true)],
    maxImageFileSize: Joi.number().default(DEFAULT.maxImageFileSize),
    include: Joi.any().default(DEFAULT.include),
    concurrency: Joi.number().default(DEFAULT.concurrency),
    penthouse: Joi.object()
      .keys({
        url: Joi.any().forbidden(),
        css: Joi.any().forbidden(),
        width: Joi.any().forbidden(),
        height: Joi.any().forbidden(),
        timeout: Joi.number().default(DEFAULT.timeout),
        forceInclude: Joi.any(),
        maxEmbeddedBase64Length: Joi.number(),
      })
      .unknown(true),
    rebase: Joi.object().keys({
      from: Joi.string(),
      to: Joi.string(),
    }),
    target: [
      Joi.string(),
      Joi.object().keys({
        css: Joi.string(),
        html: Joi.string(),
      }),
    ],
    assetPaths: Joi.array().items(Joi.string()),
    userAgent: Joi.string(),
  })
  .label('options')
  .xor('html', 'src');

function getOptions(options = {}) {
  const {error, value} = Joi.validate(options, schema);
  const {inline, dimensions, penthouse = {}, target, ignore} = value || {};

  if (error) {
    const {details = []} = error;
    const [detail = {}] = details;
    const {message = 'invalid options'} = detail;

    throw new ConfigError(message);
  }

  if (!dimensions) {
    value.dimensions = [
      {
        width: options.width || DEFAULT.width,
        height: options.height || DEFAULT.height,
      },
    ];
  }

  if (typeof target === 'string') {
    const key = /\.css$/.test(target) ? 'css' : 'html';
    value.target = {[key]: target};
  }

  // Set inline options
  value.inline = Boolean(inline) && {
    minify: value.minify,
    extract: value.extract || false,
    basePath: value.base || process.cwd(),
    ...(inline === true ? {} : inline),
  };

  // Set penthouse options
  value.penthouse = {
    forceInclude: value.include,
    timeout: DEFAULT.timeout,
    maxEmbeddedBase64Length: value.maxImageFileSize,
    ...penthouse,
  };

  if (ignore && Array.isArray(ignore)) {
    value.ignore = {
      atrule: ignore,
      rule: ignore,
      decl: ignore,
    };
  }

  return value;
}

module.exports = {
  DEFAULT,
  getOptions,
};
