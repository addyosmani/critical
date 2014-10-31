# critical [![Build Status](https://travis-ci.org/addyosmani/critical.svg?branch=master)](https://travis-ci.org/addyosmani/critical)

![](http://i.imgur.com/lAzmBD2.png)

Critical extracts & inlines critical-path (above-the-fold) CSS from HTML

## Install

```sh
$ npm install --save critical
```

## Build plugins

* [grunt-critical](https://github.com/bezoerb/grunt-critical)
* Gulp users should use Critical directly

## Demo projects

* [Optimize a basic page with Gulp](https://github.com/addyosmani/critical-path-css-demo) with a [tutorial](https://github.com/addyosmani/critical-path-css-demo#tutorial)
* [Optimize an Angular boilerplate with Gulp](https://github.com/addyosmani/critical-path-angular-demo)
* [Optimize a Weather app with Gulp](https://github.com/addyosmani/critical-css-weather-app)

## Usage

Include:

```js
var critical = require('critical');
```

### Generate and inline critical-path CSS

```js
critical.generateInline({
    // Your base directory
    base: 'dist/',

    // HTML source
    html: '<html>...</html>',
    
    // HTML source file
    src: 'index.html',

    // Your CSS Files (optional)
    css: ['dist/styles/main.css'],

    // Viewport width
    width: 320,

    // Viewport height
    height: 480,

    // Target for final HTML output
    htmlTarget: 'index-critical.html',

    // Target for generated critical-path CSS (which we inline)
    styleTarget: 'styles/main.css',

    // Minify critical-path CSS when inlining
    minify: true,

    // Extract inlined styles from referenced stylesheets
    extract: true
});
```

### Generate critical-path CSS

Basic usage:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    dest: 'styles/main.css',
    width: 320,
    height: 480
});
```

Generate and minify critical-path CSS:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    dest: 'styles/styles.min.css',
    minify: true,
    width: 320,
    height: 480
});
```

Generate and return output via a callback:

```js
critical.generate({
    base: 'test/',
    src: 'index.html',
    width: 320,
    height: 480
}, function (err, output) {
    // You now have critical-path CSS
    // Works with and without dest specified
});
```

### Inline `<style>` / critical CSS from generation

Basic usage:

```js
critical.inline({
    base: 'test/',
    src: 'index-critical.html',
    dest: 'inlined.html'
});
```

Minify and inline stylesheets:

```js
critical.inline({
    base: 'test/',
    src: 'index-critical.html',
    dest: 'inlined-minified.html',
    minify: true
});
```

Inline and return output via a callback:

```js
critical.inline({
    base: 'test/',
    src: 'index-critical.html'
}, function (err, output){
    // You now have HTML with inlined critical-path CSS
    // Works with and without dest specified
});
```

### Options

| Name             | Type          | Description   |
| ---------------- | ------------- | ------------- |
| base             | `string`      | Base directory in which the source and destination are to be written |
| html             | `string`      | HTML source to be operated against. This option takes precedence over the `src` option |
| src              | `string`      | Location of the HTML source to be operated against |
| dest             | `string`      | Location of where to save the output of an operation |
| width            | `integer`     | (Generation only) Width of the target viewport |
| height           | `integer`     | (Generation only) Height of the target viewport |
| minify           | `boolean`     | Enable minification of CSS output |
| extract          | `boolean`     | Remove the inlined styles from any stylesheets referenced in the HTML. It generates new references based on extracted content so it's safe to use for multiple HTML files referencing the same stylesheet|
| styleTarget      | `string`      | (`generateInline` only) Destination for critical-path styles |
| htmlTarget       | `string`      | (`generateInline` only) Destination for (critical-path CSS) style-inlined HTML |
| inlineImages     | `boolean`     | Inline images (default: false)
| maxImageFileSize | `integer`     | Sets a max file size (in bytes) for base64 inlined images

## CLI

critical works well with standard input.

```shell
cat test/fixture/index.html | critical --base test/fixture > critical.css
```

You can also pass in the critical CSS file as an option.

```shell
critical test/fixture/index.html --base test/fixture > critical.css
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

Many of the current tools around critical-path CSS are in an experimental stage and are constantly striving
to improve. The same could be said of Critical. It hasn't been extensively tested on a ton of sites and it's
very possible something may well break. That said, we welcome you to try it out on your project and report
bugs if you find them.

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/addyosmani/critical/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.
