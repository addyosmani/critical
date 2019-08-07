[![NPM version][npm-image]][npm-url] [![Linux Build Status][travis-image]][travis-url] [![Windows Build status][appveyor-image]][appveyor-url] [![dependencies Status][depstat-image]][depstat-url] [![devDependencies Status][devdepstat-image]][devdepstat-url] [![Coverage][coveralls-image]][coveralls-url]

# critical

Critical extracts & inlines critical-path (above-the-fold) CSS from HTML

<img src="https://raw.githubusercontent.com/addyosmani/critical/master/preview.png" alt="Preview" width="378">

## Install

### Install current beta version

```sh
npm i -D critical@next
```

### Install latest stable version

```sh
npm i -D critical@latest
```

The docs for the latest 1.x version can be found [here](https://github.com/addyosmani/critical/tree/1.x).

## Breaking Changes

We’ve introduced some breaking changes in this release so be sure to check out the [changelog](CHANGELOG.md).

## Build plugins

- [grunt-critical](https://github.com/bezoerb/grunt-critical)
- Gulp users should use Critical directly
- For Webpack use [html-critical-webpack-plugin](https://github.com/anthonygore/html-critical-webpack-plugin)

## Demo projects

- [Optimize a basic page with Gulp](https://github.com/addyosmani/critical-path-css-demo) with a [tutorial](https://github.com/addyosmani/critical-path-css-demo#tutorial)
- [Optimize an Angular boilerplate with Gulp](https://github.com/addyosmani/critical-path-angular-demo)
- [Optimize a Weather app with Gulp](https://github.com/addyosmani/critical-css-weather-app)

## Usage

Include:

```js
const critical = require('critical');
```

Full blown example with available options:

```js
critical.generate({
  // Inline the generated critical-path CSS
  // - true generates HTML
  // - false generates CSS
  inline: true,

  // Your base directory
  base: 'dist/',

  // HTML source
  html: '<html>...</html>',

  // HTML source file
  src: 'index.html',

  // Your CSS Files (optional)
  css: ['dist/styles/main.css'],

  // Viewport width
  width: 1300,

  // Viewport height
  height: 900,

  // Output results to file
  target: {
    css: 'critical.css',
    html: 'index-critical.html',
    uncritical: 'uncritical.css'
  },

  // Minify critical-path CSS when inlining
  minify: true,

  // Extract inlined styles from referenced stylesheets
  extract: true,

  // Complete Timeout for Operation
  timeout: 30000,

  // ignore CSS rules
  ignore: {
    atrule: ['@font-face'],
    rule: [/some-regexp/],
    decl: (node, value) => /big-image\.png/.test(value)
  }
});
```

### Generate and inline critical-path CSS

Basic usage:

```js
critical.generate({
  inline: true,
  base: 'test/',
  src: 'index.html',
  target: 'index-critical.html',
  width: 1300,
  height: 900
});
```

### Generate critical-path CSS

Basic usage:

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  target: 'styles/main.css',
  width: 1300,
  height: 900
});
```

Generate and minify critical-path CSS:

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  target: 'styles/styles.min.css',
  width: 1300,
  height: 900
});
```

Generate, minify and inline critical-path CSS:

```js
critical.generate({
    inline: true,
    base: 'test/',
    src: 'index.html',
    target: {
      html: 'index-critical.html',
      css: 'critical.css'
    },
    width: 1300,
    height: 900
});
```

Generate and return output via callback:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    width: 1300,
    height: 900,
    inline: true
}, (err, ({css, html, uncritical})) => {
    // You now have critical-path CSS as well as the modified HTML.
    // Works with and without target specified.
    ...
});
```

Generate and return output via promise:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    width: 1300,
    height: 900
}).then((({css, html, uncritical})) => {
    // You now have critical-path CSS as well as the modified HTML.
    // Works with and without target specified.
    ...
}).error(err => {
    ...
});
```

Generate and return output via async function:

```js
const {css, html, uncritical} = await critical.generate({
  base: 'test/',
  src: 'index.html',
  width: 1300,
  height: 900
});
```

### Generate critical-path CSS with multiple resolutions

When your site is adaptive and you want to deliver critical CSS for multiple screen resolutions this is a useful option.
_note:_ (your final output will be minified as to eliminate duplicate rule inclusion)

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  dest: 'styles/main.css',
  dimensions: [{
      height: 200,
      width: 500
    },
    {
      height: 900,
      width: 1200
  }]
});
```

### Generate critical-path CSS and ignore specific selectors

This is a useful option when you e.g. want to defer loading of webfonts or background images.

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  dest: 'styles/main.css',
  ignore: {
    atrule: ['@font-face'],
    decl: (node, value) => /url\(/.test(value)
  }
});
```

### Generate critical-path CSS and specify asset rebase behaviour

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  dest: 'styles/main.css',
  rebase: {
    from: '/styles/main.css',
    to: '/folder/subfolder/index.html'
  }
});
```

```js
critical.generate({
  base: 'test/',
  src: 'index.html',
  dest: 'styles/main.css',
  rebase: asset => `https://my-cdn.com${asset.absolutePath}`
});
```

### Options

| Name             | Type                    | Default                                | Description                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inline           | `boolean`\|`object`     | `false`                                | Inline critical-path CSS using filamentgroup's loadCSS. Pass an object to configure [`inline-critical`](https://github.com/bezoerb/inline-critical#inlinehtml-styles-options)                                                                                                                                                                                                   |
| base             | `string`                | `path.dirname(src)` or `process.cwd()` | Base directory in which the source and destination are to be written                                                                                                                                                                                                                                                                                                            |
| html             | `string`                |                                        | HTML source to be operated against. This option takes precedence over the `src` option.                                                                                                                                                                                                                                                                                         |
| css              | `array`                 | `[]`                                   | An array of paths to css files, file globs or [Vinyl](https://www.npmjs.com/package/vinyl) file objects.                                                                                                                                                                                                                                                                        |
| src              | `string`                |                                        | Location of the HTML source to be operated against                                                                                                                                                                                                                                                                                                                              |
| target           | `string` or `object`    |                                        | Location of where to save the output of an operation. Use an object with 'html' and 'css' props if you want to store both                                                                                                                                                                                                                                                       |
| width            | `integer`               | `1300`                                 | Width of the target viewport                                                                                                                                                                                                                                                                                                                                                    |
| height           | `integer`               | `900`                                  | Height of the target viewport                                                                                                                                                                                                                                                                                                                                                   |
| dimensions       | `array`                 | `[]`                                   | An array of objects containing height and width. Takes precedence over `width` and `height` if set                                                                                                                                                                                                                                                                              |
| minify           | `boolean`               | `true`                                 | Enable minification of generated critical-path CSS                                                                                                                                                                                                                                                                                                                              |
| extract          | `boolean`               | `false`                                | Remove the inlined styles from any stylesheets referenced in the HTML. It generates new references based on extracted content so it's safe to use for multiple HTML files referencing the same stylesheet. Use with caution. Removing the critical CSS per page results in a unique async loaded CSS file for every page. Meaning you can't rely on cache across multiple pages |
| inlineImages     | `boolean`               | `false`                                | Inline images                                                                                                                                                                                                                                                                                                                                                                   |
| assetPaths       | `array`                 | `[]`                                   | List of directories/urls where the inliner should start looking for assets                                                                                                                                                                                                                                                                                                      |
| maxImageFileSize | `integer`               | `10240`                                | Sets a max file size (in bytes) for base64 inlined images                                                                                                                                                                                                                                                                                                                       |
| rebase           | `object` or `function`  | `undefined`                            | Critical tries it's best to rebase the asset paths relative to the document. If this doesn't work as expected you can always use this option to control the rebase paths. See [`postcss-url`](https://github.com/postcss/postcss-url) for details. (https://github.com/pocketjoso/penthouse#usage-1).                                                                           |
| ignore           | `array`                 | `object`                               | `undefined`                                                                                                                                                                                                                                                                                                                                                                     | Ignore CSS rules. See [`postcss-discard`](https://github.com/bezoerb/postcss-discard) for usage examples. If you pass an array all rules will be applied to atrules, rules and declarations; |
| userAgent        | `string`                | `''`                                   | User agent to use when fetching a remote src                                                                                                                                                                                                                                                                                                                                    |
| penthouse        | `object`                | `{}`                                   | Configuration options for [`penthouse`](https://github.com/pocketjoso/penthouse).                                                                                                                                                                                                                                                                                               |
| user             | `string`                | `undefined`                            | RFC2617 basic authorization: user                                                                                                                                                                                                                                                                                                                                               |
| pass             | `string`                | `undefined`                            | RFC2617 basic authorization: pass                                                                                                                                                                                                                                                                                                                                               |
| strict           | `boolean`               | `false`                                | Throw an error if no css is found |


## CLI

```sh
npm install -g critical
```

critical works well with standard input.

```sh
cat test/fixture/index.html | critical --base test/fixture --inline > index.critical.html
```

Or on Windows:

```bat
type test\fixture\index.html | critical --base test/fixture --inline > index.critical.html
```

You can also pass in the critical CSS file as an option.

```sh
critical test/fixture/index.html --base test/fixture > critical.css
```

## Gulp

```js
const gulp = require('gulp');
const log = require('fancy-log');
const critical = require('critical').stream;

// Generate & Inline Critical-path CSS
gulp.task('critical', () => {
  return gulp
    .src('dist/*.html')
    .pipe(critical({
      base: 'dist/',
      inline: true,
      css: [
        'dist/styles/components.css',
        'dist/styles/main.css'
      ]
    }))
    .on('error', err => {
      log.error(err.message);
    })
    .pipe(gulp.dest('dist'));
});
```

## Why?

### Why is critical-path CSS important?

> CSS is required to construct the render tree for your pages and JavaScript
> will often block on CSS during initial construction of the page.
> You should ensure that any non-essential CSS is marked as non-critical
> (e.g. print and other media queries), and that the amount of critical CSS
> and the time to deliver it is as small as possible.

### Why should critical-path CSS be inlined?

> For best performance, you may want to consider inlining the critical CSS
> directly into the HTML document. This eliminates additional roundtrips
> in the critical path and if done correctly can be used to deliver a
> “one roundtrip” critical path length where only the HTML is a blocking resource.

## FAQ

### Are there any sample projects available using Critical?

Why, yes!. Take a look at [this](https://github.com/addyosmani/critical-path-css-demo) Gulp project
which demonstrates using Critical to generate and inline critical-path CSS. It also includes a mini-tutorial
that walks through how to use it in a simple webapp.

### When should I just use Penthouse directly?

The main differences between Critical and [Penthouse](https://github.com/pocketjoso/penthouse), a module we
use, are:

- Critical will automatically extract stylesheets from your HTML from which to generate critical-path CSS from,
  whilst other modules generally require you to specify this upfront.
- Critical provides methods for inlining critical-path CSS (a common logical next-step once your CSS is generated)
- Since we tackle both generation and inlining, we're able to abstract away some of the ugly boilerplate otherwise
  involved in tackling these problems separately.

That said, if your site or app has a large number of styles or styles which are being dynamically injected into
the DOM (sometimes common in Angular apps) I recommend using Penthouse directly. It will require you to supply
styles upfront, but this may provide a higher level of accuracy if you find Critical isn't serving your needs.

### What other alternatives to Critical are available?

FilamentGroup maintain a [criticalCSS](https://github.com/filamentgroup/criticalCSS) node module, which
similar to [Penthouse](https://github.com/pocketjoso/penthouse) will find and output the critical-path CSS for
your pages. The PageSpeed Optimization modules for nginx, apache, IIS, ATS, and Open Lightspeed can do all the heavy
lifting automatically when you enable the [prioritize_critical_css](https://developers.google.com/speed/docs/insights/OptimizeCSSDelivery) filter

### Is Critical stable and suitable for production use?

Critical has been used on a number of production sites that have found it stable for everyday use.
That said, we welcome you to try it out on your project and report bugs if you find them.

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/addyosmani/critical/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

## Maintainers

This module is brought to you and maintained by the following people:

- Addy Osmani - Creator ([Github](https://github.com/addyosmani) / [Twitter](https://twitter.com/addyosmani))
- Ben Zörb - Primary maintainer ([Github](https://github.com/bezoerb) / [Twitter](https://twitter.com/bezoerb))

## License

[Apache-2.0 © Addy Osmani, Ben Zörb](license)

[npm-url]: https://www.npmjs.com/package/critical
[npm-image]: https://img.shields.io/npm/v/critical.svg
[travis-url]: https://travis-ci.org/addyosmani/critical
[travis-image]: https://img.shields.io/travis/addyosmani/critical/master.svg?label=Linux%20build
[appveyor-url]: https://ci.appveyor.com/project/addyosmani/critical/branch/master
[appveyor-image]: https://img.shields.io/appveyor/ci/addyosmani/critical/master.svg?label=Windows%20build
[depstat-url]: https://david-dm.org/addyosmani/critical
[depstat-image]: https://img.shields.io/david/addyosmani/critical.svg
[devdepstat-url]: https://david-dm.org/addyosmani/critical?type=dev
[devdepstat-image]: https://img.shields.io/david/dev/addyosmani/critical.svg
[coveralls-url]: https://coveralls.io/github/addyosmani/critical?branch=master
[coveralls-image]: https://img.shields.io/coveralls/github/addyosmani/critical/master.svg
