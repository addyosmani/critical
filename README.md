# critical [![NPM version][npm-image]][npm-url] [![Linux Build Status][travis-image]][travis-url] [![Windows Build status][appveyor-image]][appveyor-url] [![dependencies Status][depstat-image]][depstat-url] [![devDependencies Status Status][devdepstat-image]][devdepstat-url]

Critical extracts & inlines critical-path (above-the-fold) CSS from HTML

![](https://i.imgur.com/lAzmBD2.png)


## Install

```
$ npm install --save critical
```

## Build plugins

- [grunt-critical](https://github.com/bezoerb/grunt-critical)
- Gulp users should use Critical directly


## Demo projects

- [Optimize a basic page with Gulp](https://github.com/addyosmani/critical-path-css-demo) with a [tutorial](https://github.com/addyosmani/critical-path-css-demo#tutorial)
- [Optimize an Angular boilerplate with Gulp](https://github.com/addyosmani/critical-path-angular-demo)
- [Optimize a Weather app with Gulp](https://github.com/addyosmani/critical-css-weather-app)


## Usage

Include:

```js
var critical = require('critical');
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

    // Target for final HTML output.
    // use some CSS file when the inline option is not set
    dest: 'index-critical.html',

    // Minify critical-path CSS when inlining
    minify: true,

    // Extract inlined styles from referenced stylesheets
    extract: true,

    // Complete Timeout for Operation
    timeout: 30000,

    // Prefix for asset directory
    pathPrefix: '/MySubfolderDocrot',

    // ignore CSS rules
    ignore: ['font-face',/some-regexp/],

    // overwrite default options
    ignoreOptions: {}
});
```

### Generate and inline critical-path CSS

Basic usage:

```js
critical.generate({
    inline: true,
    base: 'test/',
    src: 'index.html',
    dest: 'index-critical.html',
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
    dest: 'styles/main.css',
    width: 1300,
    height: 900
});
```

Generate and minify critical-path CSS:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    dest: 'styles/styles.min.css',
    minify: true,
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
    dest: 'index-critical.html',
    minify: true,
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
    height: 900
}, function (err, output) {
    // You now have critical-path CSS
    // Works with and without dest specified
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
}).then(function (output) {
    // You now have critical-path CSS
    // Works with and without dest specified
    ...
}).error(function (err) {
    ...
});
```

### Generate critical-path CSS with multiple resolutions

When your site is adaptive and you want to deliver critical CSS for multiple screen resolutions this is a useful option.
*note:* (your final output will be minified as to eliminate duplicate rule inclusion)

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    dest: 'styles/main.css',
    dimensions: [{
        height: 200,
        width: 500
    }, {
        height: 900,
        width: 1200
    }]
});
```

### Generate critical-path CSS and ignore specific selectors

This is a usefull option when you e.g. want to defer loading of webfonts or background images.

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    dest: 'styles/main.css',
    ignore: ['@font-face',/url\(/]
});
```


### Options

| Name             | Type               | Default | Description   |
| ---------------- | ------------------ | ------------- |------------- |
| inline           | `boolean`|`object` | `false` | Inline critical-path CSS using filamentgroup's loadCSS. Pass an object to configure [`inline-critical`](https://github.com/bezoerb/inline-critical#inlinehtml-styles-options) |
| base             | `string`           | `path.dirname(src)` or `process.cwd()` | Base directory in which the source and destination are to be written |
| html             | `string`           | | HTML source to be operated against. This option takes precedence over the `src` option |
| css              | `array`            | `[]` | An array of paths to css files, or an array of [Vinyl](https://www.npmjs.com/package/vinyl) file objects.
| src              | `string`           | | Location of the HTML source to be operated against |
| dest             | `string`           | | Location of where to save the output of an operation (will be relative to base if no absolute path is set) |  
| destFolder       | `string`           | `''` | Subfolder relative to base directory. Only relevant without src (if raw html is provided) or if the destination is outside base |
| width            | `integer`          | `900`  | Width of the target viewport |
| height           | `integer`          | `1300` | Height of the target viewport |
| dimensions       | `array`            | `[]` | An array of objects containing height and width. Takes precedence over `width` and `height` if set
| minify           | `boolean`          | `false` | Enable minification of generated critical-path CSS |
| extract          | `boolean`          | `false` | Remove the inlined styles from any stylesheets referenced in the HTML. It generates new references based on extracted content so it's safe to use for multiple HTML files referencing the same stylesheet. Use with caution. Removing the critical CSS per page results in a unique async loaded CSS file for every page. Meaning you can't rely on cache across multiple pages |
| inlineImages     | `boolean`          | `false` | Inline images
| assetPaths       | `array`            | `[]` | List of directories/urls where the inliner should start looking for assets
| maxImageFileSize | `integer`          | `10240`| Sets a max file size (in bytes) for base64 inlined images
| timeout          | `integer`          | `30000`| Sets a maximum timeout for the operation
| pathPrefix       | `string`           | `/` | Path to prepend CSS assets with. You *must* make this path absolute if you are going to be using critical in multiple target files in disparate directory depths. (eg. targeting both `/index.html` and `/admin/index.html` would require this path to start with `/` or it wouldn't work.)
| include          | `array`            | `[]` | Force include CSS rules. See [`penthouse#usage`](https://github.com/pocketjoso/penthouse#usage-1).
| ignore           | `array`            | `[]` | Ignore CSS rules. See [`filter-css`](https://github.com/bezoerb/filter-css) for usage examples.
| ignoreOptions    | `object`           | `{}` | Ignore options. See [`filter-css#options`](https://github.com/bezoerb/filter-css#options).
| penthouse        | `object`           | `{}` | Configuration options for [`penthouse`](https://github.com/pocketjoso/penthouse).


## CLI

```
$ npm install -g critical
```

critical works well with standard input.

```
$ cat test/fixture/index.html | critical --base test/fixture --inline > index.critical.html
```

You can also pass in the critical CSS file as an option.

```
$ critical test/fixture/index.html --base test/fixture > critical.css
```


## Gulp

```js
var gulp = require('gulp');
var gutil = require('gulp-util');
var critical = require('critical').stream;

// Generate & Inline Critical-path CSS
gulp.task('critical', function () {
    return gulp.src('dist/*.html')
        .pipe(critical({base: 'dist/', inline: true, css: ['dist/styles/components.css','dist/styles/main.css']}))
        .on('error', function(err) { gutil.log(gutil.colors.red(err.message)); })
        .pipe(gulp.dest('dist'));
});
```

## Why?

### Why is critical-path CSS important?

> CSS is required to construct the render tree for your pages and JavaScript
will often block on CSS during initial construction of the page.
You should ensure that any non-essential CSS is marked as non-critical
(e.g. print and other media queries), and that the amount of critical CSS
and the time to deliver it is as small as possible.

### Why should critical-path CSS be inlined?

> For best performance, you may want to consider inlining the critical CSS
directly into the HTML document. This eliminates additional roundtrips
in the critical path and if done correctly can be used to deliver a
“one roundtrip” critical path length where only the HTML is a blocking resource.


## FAQ

### Are there any sample projects available using Critical?

Why, yes!. Take a look at [this](https://github.com/addyosmani/critical-path-css-demo) Gulp project
which demonstrates using Critical to generate and inline critical-path CSS. It also includes a mini-tutorial
that walks through how to use it in a simple webapp.

### When should I just use Penthouse directly?

The main differences between Critical and [Penthouse](https://github.com/pocketjoso/penthouse), a module we
use, are:

* Critical will automatically extract stylesheets from your HTML from which to generate critical-path CSS from,
whilst other modules generally require you to specify this upfront.
* Critical provides methods for inlining critical-path CSS (a common logical next-step once your CSS is generated)
* Since we tackle both generation and inlining, we're able to abstract away some of the ugly boilerplate otherwise
involved in tackling these problems separately.

That said, if your site or app has a large number of styles or styles which are being dynamically injected into
the DOM (sometimes common in Angular apps) I recommend using Penthouse directly. It will require you to supply
styles upfront, but this may provide a higher level of accuracy if you find Critical isn't serving your needs.

### What other alternatives to Critical are available?

FilamentGroup maintain a [criticalCSS](https://github.com/filamentgroup/criticalCSS) node module, which
similar to [Penthouse](https://github.com/pocketjoso/penthouse) will find and output the critical-path CSS for
your pages.

### Is Critical stable and suitable for production use?

Critical has been used on a number of production sites that have found it stable for everyday use.
That said, we welcome you to try it out on your project and report bugs if you find them.

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/addyosmani/critical/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

## Maintainers

This module is brought to you and maintained by the following people:

* Addy Osmani - Creator ([Github](https://github.com/addyosmani) / [Twitter](https://twitter.com/addyosmani))
* Ben Zörb - Primary maintainer ([Github](https://github.com/bezoerb) / [Twitter](https://twitter.com/bezoerb))

## License

Apache-2.0 © Addy Osmani, Ben Zörb


[npm-url]: https://www.npmjs.com/package/critical
[npm-image]: https://img.shields.io/npm/v/critical.svg

[travis-url]: https://travis-ci.org/addyosmani/critical
[travis-image]: https://img.shields.io/travis/addyosmani/critical/master.svg?label=Linux%20build

[appveyor-url]: https://ci.appveyor.com/project/addyosmani/critical/branch/master
[appveyor-image]: https://img.shields.io/appveyor/ci/addyosmani/critical/master.svg?label=Windows%20build

[depstat-url]: https://david-dm.org/addyosmani/critical
[depstat-image]: https://david-dm.org/addyosmani/critical/status.svg

[devdepstat-url]: https://david-dm.org/addyosmani/critical?type=dev
[devdepstat-image]: https://david-dm.org/addyosmani/critical/dev-status.svg
