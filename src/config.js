'use strict';

const Joi = require('@hapi/joi');
const debug = require('debug')('critical:config');
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
    ignore: [Joi.array(), Joi.object().unknown(true)],
    width: Joi.number().default(DEFAULT.width),
    height: Joi.number().default(DEFAULT.height),
    minify: Joi.boolean().default(DEFAULT.minify),
    dimensions: Joi.array().items({width: Joi.number(), height: Joi.number()}),
    inline: [Joi.boolean().default(DEFAULT.inline), Joi.object().unknown(true)],
    maxImageFileSize: Joi.number().default(DEFAULT.maxImageFileSize),
    include: Joi.any().default(DEFAULT.include),
    concurrency: Joi.number().default(DEFAULT.concurrency),
    user: Joi.string(),
    pass: Joi.string(),
    request: Joi.object().unknown(true),
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
    rebase: [
      Joi.object().keys({
        from: Joi.string(),
        to: Joi.string(),
      }),
      Joi.func(),
      Joi.boolean(),
    ],
    target: [
      Joi.string(),
      Joi.object().keys({
        css: Joi.string(),
        html: Joi.string(),
        uncritical: Joi.string(),
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
    basePath: value.base || process.cwd(),
    ...(inline === true ? {} : inline),
  };

  if (value.inline.replaceStylesheets !== undefined && !Array.isArray(value.inline.replaceStylesheets)) {
    if (value.inline.replaceStylesheets === 'false') {
      value.inline.replaceStylesheets = false;
    } else if (typeof value.inline.replaceStylesheets !== 'function') {
      value.inline.replaceStylesheets = [value.inline.replaceStylesheets];
    }
  }

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

  if (target && target.uncritical) {
    value.extract = true;
  }

  debug(value);

  return value;
}

const validate = (key, val) => {
  const {error} = Joi.validate({[key]: val, html: '<html/>'}, schema);
  if (error) {
    return false;
  }

  return true;
};

module.exports = {
  DEFAULT,
  validate,
  getOptions,
};
