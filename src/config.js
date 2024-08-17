import process from 'node:process';
import Joi from 'joi';
import debugBase from 'debug';
import {traverse, STOP} from 'async-traverse-tree';
import {ConfigError} from './errors.js';

const debug = debugBase('critical:config');

export const DEFAULT = {
  width: 1300,
  height: 900,
  timeout: 30_000,
  maxImageFileSize: 10_240,
  inline: false,
  strict: false,
  extract: false,
  inlineImages: false,
  ignoreInlinedStyles: false,
  concurrency: Number.POSITIVE_INFINITY,
  include: [],
};

const schema = Joi.object()
  .keys({
    html: Joi.string(),
    src: [Joi.string(), Joi.object()],
    css: [Joi.string(), Joi.array()],
    base: Joi.string(),
    strict: Joi.boolean().default(DEFAULT.strict),
    ignoreInlinedStyles: Joi.boolean().default(DEFAULT.ignoreInlinedStyles),
    extract: Joi.boolean().default(DEFAULT.extract),
    inlineImages: Joi.boolean().default(DEFAULT.inlineImages),
    postcss: Joi.array(),
    ignore: [Joi.array(), Joi.object().unknown(true)],
    width: Joi.number().default(DEFAULT.width),
    height: Joi.number().default(DEFAULT.height),
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
    cleanCSS: Joi.object().unknown(true),
  })
  .label('options')
  .xor('html', 'src');

export async function getOptions(options = {}) {
  const parsedOptions = await traverse(options, (key, value) => {
    if (['css', 'html', 'src'].includes(key)) {
      return STOP;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {}
    }

    return value;
  });

  const {error, value} = schema.validate(parsedOptions);

  const {inline, dimensions, penthouse = {}, target, ignore} = value || {};

  if (error) {
    const {details = []} = error;
    const [detail = {}] = details;
    const {message = 'invalid options'} = detail;

    throw new ConfigError(message);
  }

  if (!dimensions || dimensions.length === 0) {
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
    basePath: value.base || process.cwd(),
    ...(inline === true ? {strategy: 'media'} : inline),
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

export const validate = (key, val) => {
  const {error} = schema.validate({[key]: val, html: '<html/>'});
  if (error) {
    return false;
  }

  return true;
};
