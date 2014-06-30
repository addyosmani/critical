critical
========

> Critical Path CSS generation &amp; inlining

## Installation

```
npm install -g critical
```

## Usage

Include:

```sh
var critical = require('critical');
```

###Generate critical-path CSS

Basic usage:

```js
critical.generate({
	  base: 'test/',
	  src: 'index.html',
	  dest: 'styles/main.css',
	  width: 320,
	  height: 480,
	});
```

Generate and minify critical-path CSS:

```js
critical.generate({
	  base: 'test/',
	  src: 'index.html',
	  width: 320,
	  dest: 'styles/styles.min.css',
	  minify: true,
	  height: 480
	});
```

Generate and return output via a callback:

```js
critical.generate({
	  base: 'test/',
	  src: 'index.html',
	  width: 320,
	  height: 480,
	}, function (err, output){
		// You now have critical-path CSS
		// Works with and without dest specified
	});
```

###Inline `<style>` / critical CSS from generation

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
	  src: 'index-critical.html',
	}, function (err, output){
		// You now have HTML with inlined critical-path CSS
		// Works with and without dest specified
	});
```

###Options

####base
Type: `String`

Base directory in which the source and destination are to be written.

####src
Type: `String`

Location of the HTML source to be operated against.

####dest
Type: `String`

Location of where to save the output of an operation.

####width
Type: `integer`

(Generation only) Width of the target viewport.

####height
Type: `integer`

(Generation only) Height of the target viewport.

####minify
Type: `boolean`

Enable minification of CSS output

## Why?

### Why is critical-path CSS important?

> CSS is required to construct the render tree for your pages and JavaScript will often block on CSS during initial construction of the page. You should ensure that any non-essential CSS is marked as non-critical (e.g. print and other media queries), and that the amount of critical CSS and the time to deliver it is as small as possible.

### Why should critical-path CSS be inlined?

> For best performance, you may want to consider inlining the critical CSS directly into the HTML document. This eliminates additional roundtrips in the critical path and if done correctly can be used to deliver a “one roundtrip” critical path length where only the HTML is a blocking resource.

## FAQ

### When should I just use Penthouse directly?

I recommend using Penthouse directly if your app has a large number of styles or stylesheets being dynamically injected into the DOM. Critical is best used when your page uses a fixed set of stylesheets as we can automatically scrape this for you, avoiding the overhead of passing known styles yourself manually to Penthouse.

## License

Apache 2.0  
Copyright 2014 Google Inc


