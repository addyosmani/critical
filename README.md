# critical

> Extract the critical-path (above-the-fold) CSS from your HTML, inline it, and load the rest
> asynchronously — so the browser can paint the first screen without waiting on a full stylesheet.

Critical removes render-blocking CSS from the critical path, which is one of the most direct
levers on **Largest Contentful Paint** and first render. It works for static sites, MPAs, and
single-page apps, and it's built to be driven by humans, build pipelines, and coding agents
alike.

```sh
npm install --save-dev critical
```

---

## Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Two engines](#two-engines)
- [CLI reference](#cli-reference)
- [API reference](#api-reference)
- [Inlining behavior](#inlining-behavior)
- [Tuning the above-the-fold set](#tuning-the-above-the-fold-set)
- [MCP server (agents)](#mcp-server-agents)
- [Recipes](#recipes)
- [Design principles](#design-principles)
- [Requirements](#requirements)
- [Alternatives](#alternatives)

---

## How it works

Given an HTML document and its stylesheets, Critical:

1. **Determines what's critical.** It figures out which CSS rules style the content that paints
   above the fold — either by matching rules against the delivered DOM (fast, no browser) or by
   rendering the page in a real viewport (accurate, handles SPAs). See [Two engines](#two-engines).
2. **Inlines it.** The critical rules go into a `<style>` at the top of `<head>` so first paint
   needs only the HTML.
3. **Defers the rest.** Each `<link rel="stylesheet">` is replaced in the head by a
   `<link rel="preload">` and moved to the end of the body, so it no longer blocks first paint.
   No inline scripts are added, so it works under a strict Content Security Policy.

The output is deterministic: the same input produces byte-identical output, so it's safe to run
in CI and diff in version control.

## Quick start

### CLI

```sh
# Optimize a build directory in place (inlines critical CSS, defers the rest)
critical ./dist --inline --write

# See what it would do and why, without writing anything
critical ./dist --explain

# A single file to stdout
critical index.html --inline > index.critical.html
```

### API

```js
import { critical } from "critical";

const { html, css, report } = await critical({
  src: "dist/index.html",
  inline: true,
});

// `html`   — the document with critical CSS inlined and stylesheets deferred
// `css`    — the critical CSS on its own (minified)
// `report` — structured diagnostics (engine used, bytes, rules, warnings, timing)
```

`critical()` never writes to disk on its own — it returns the result. Use the CLI's `--write`
/ `--out`, or write `result.html` / `result.css` yourself.

## Two engines

Critical picks the right strategy for each document automatically (`engine: "auto"`, the
default), and tells you which it used and why.

| Engine     | How it decides what's critical                                               | Needs a browser  | Best for                                                     |
| ---------- | ---------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| **static** | Matches CSS rules against the delivered DOM (the used CSS)                   | No               | SSG / SSR / MPA output that ships real markup                |
| **render** | Loads the page at a real viewport and measures what's painted above the fold | Yes (Playwright) | SPA shells, and when you want a tight, viewport-accurate set |

**Automatic routing.** When `engine` is `"auto"`, Critical inspects the delivered HTML. If the
document already contains rendered content, the static engine is correct and runs in
milliseconds. If the document is an empty application shell (e.g. `<div id="root"></div>` with
no markup yet), there's nothing to match against statically, so Critical escalates to the render
engine and measures the page the way a browser actually paints it.

You can always pin the engine explicitly with `engine: "static"` or `engine: "render"`.

> The render engine uses [Playwright](https://playwright.dev), declared as an **optional** peer
> dependency. It's imported lazily, so the static path — and the default install — never pull in
> a browser. To use the render engine: `npm i -D playwright && npx playwright install chromium`.

## CLI reference

```text
critical <input> [options]

  input        a directory (all *.html are processed), an .html file, or stdin
```

| Option                                | Description                                                | Default |
| ------------------------------------- | ---------------------------------------------------------- | ------- |
| `-e, --engine <auto\|static\|render>` | Engine selection                                           | `auto`  |
| `-i, --inline`                        | Inline critical CSS and defer the rest                     | off     |
| `-w, --width <px>`                    | Render-engine viewport width                               | `1300`  |
| `-h, --height <px>`                   | Render-engine viewport height                              | `900`   |
| `--dimensions <WxH,WxH>`              | Multiple render viewports (e.g. `390x844,1300x900`)        | —       |
| `--no-fold`                           | Ignore `[data-critical-fold]` scoping in the static engine | —       |
| `--no-minify`                         | Keep the critical CSS readable instead of minifying        | —       |
| `-o, --out <file\|dir>`               | Write output here instead of stdout                        | stdout  |
| `--write`                             | Rewrite the input file(s) in place (use with `--inline`)   | off     |
| `--json`                              | Emit the structured result as JSON                         | off     |
| `--explain`                           | Print the engine decision and stats to stderr              | off     |
| `--help`                              | Show help                                                  | —       |

### Examples

```sh
critical ./dist --inline --write              # whole build dir, in place
critical index.html --explain                 # routing decision + size stats
critical app.html -e render -i > out.html     # force a real-browser pass for an SPA
critical page.html --dimensions 390x844,1300x900 -i   # union of mobile + desktop folds
cat page.html | critical --inline             # stdin -> stdout
critical ./dist --json                        # machine-readable report for CI/agents
```

## API reference

```js
import { critical } from "critical";
```

### `critical(options) → Promise<{ html, css, report }>`

| Option       | Type                             | Default                | Description                                                                             |
| ------------ | -------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `src`        | `string`                         | —                      | Path or URL to an HTML file. Provide `src` **or** `html`.                               |
| `html`       | `string`                         | —                      | Raw HTML source. Takes precedence over `src`.                                           |
| `css`        | `string \| string[]`             | —                      | Extra CSS: file paths, globs, or raw CSS strings, beyond what the document links.       |
| `base`       | `string`                         | dir of `src`, else cwd | Base directory for resolving stylesheet/asset paths.                                    |
| `engine`     | `"auto" \| "static" \| "render"` | `"auto"`               | Engine selection (see [Two engines](#two-engines)).                                     |
| `inline`     | `boolean \| object`              | `false`                | Inline critical CSS and defer the rest. Pass an object to configure inlining.           |
| `minify`     | `boolean`                        | `true`                 | Minify the critical CSS (via Lightning CSS).                                            |
| `foldAware`  | `boolean`                        | `true`                 | Honor `[data-critical-fold]` scoping in the static engine.                              |
| `width`      | `number`                         | `1300`                 | Render-engine viewport width.                                                           |
| `height`     | `number`                         | `900`                  | Render-engine viewport height.                                                          |
| `dimensions` | `Array<{width, height}>`         | —                      | Multiple render viewports; their critical sets are unioned. Overrides `width`/`height`. |
| `timeout`    | `number`                         | `30000`                | Render-engine navigation timeout (ms).                                                  |
| `userAgent`  | `string`                         | —                      | User agent for the render engine.                                                       |

The `inline` object accepts:

| Key       | Type      | Default | Description                                                                    |
| --------- | --------- | ------- | ------------------------------------------------------------------------------ |
| `preload` | `boolean` | `true`  | Insert a `<link rel="preload" as="style">` hint where each deferred sheet was. |
| `nonce`   | `string`  | —       | Nonce to set on the injected `<style>`, for a strict `style-src` CSP.          |

### The result

```js
const { html, css, report } = await critical({ src: "dist/index.html", inline: true });
```

- **`html`** — the document. Identical to the input unless `inline` is set.
- **`css`** — the critical CSS, minified (unless `minify: false`).
- **`report`** — structured diagnostics:

```jsonc
{
  "engine": "static", // engine that actually ran
  "reason": "rendered document (…) — matching used CSS without a browser",
  "requestedEngine": "auto",
  "rules": { "kept": 10, "total": 15 },
  "bytes": { "stylesheets": 1107, "critical": 544, "savedBlocking": 1107 },
  "stylesheetsDiscovered": ["/styles.css"],
  "stylesheetsDeferred": ["/styles.css"], // present when inlined
  "warnings": ["…"],
  "durationMs": 13,
  "deterministic": true,
}
```

`report` is designed to be read by a program: it explains the decision, quantifies the win
(`savedBlocking` = render-blocking bytes removed from the critical path), and surfaces any
caveats as `warnings`.

## Inlining behavior

With `inline: true`, Critical:

1. Inserts `<style data-critical>…</style>` as the first child of `<head>` so it wins the
   cascade race against the deferred sheets.
2. Stops each `<link rel="stylesheet">` from blocking the first paint, using the preload strategy:

   ```html
   <!-- in the head, where the stylesheet was: -->
   <link rel="preload" as="style" href="/styles.css" />

   <!-- moved to the end of <body>: -->
   <link rel="stylesheet" href="/styles.css" />
   ```

   The preload starts the download early; the stylesheet applies after the above-the-fold content
   (already styled by the inlined critical CSS) has painted. There is **no inline event handler**,
   so this works under a strict `script-src` Content Security Policy, and **no `<noscript>`
   fallback is needed** — the stylesheet loads normally whether or not JavaScript runs.

Add `data-critical-skip` to a `<link>` to leave it untouched. For a strict `style-src` CSP, pass
`inline: { nonce: "…" }` to stamp the injected `<style>` with your nonce.

## Tuning the above-the-fold set

- **`[data-critical-fold]` (static engine).** By default the static engine inlines all _used_
  CSS. Mark the container that holds your above-the-fold content with `data-critical-fold` and
  the static engine scopes matching to that subtree, producing a tighter critical set without a
  browser.
- **Viewports (render engine).** Use `width`/`height` or `dimensions` to define exactly what
  "above the fold" means. Multiple dimensions union their results — useful for shipping one
  critical set that covers both mobile and desktop.
- **`@font-face`, `@keyframes`, custom properties** are preserved when referenced; unused
  `@keyframes` and empty `@media`/`@supports`/`@layer` blocks are pruned.

## MCP server (agents)

Critical ships a [Model Context Protocol](https://modelcontextprotocol.io) server so an agent
can call it as a tool and receive the structured report back directly:

```sh
node src/mcp.js     # stdio MCP server exposing `optimize_critical_css`
```

```js
import { createServer } from "critical/mcp";
```

The tool takes `src`/`html` (plus optional `css`, `engine`, `inline`, `width`, `height`) and
returns the critical CSS, the rewritten HTML, and the report as structured content. Requires the
optional `@modelcontextprotocol/sdk` peer dependency.

## Recipes

**Optimize a static build directory (in CI):**

```sh
critical ./dist --inline --write
```

**Programmatically, writing both outputs:**

```js
import { writeFile } from "node:fs/promises";
import { critical } from "critical";

const { html, css } = await critical({ src: "dist/index.html", inline: true });
await writeFile("dist/index.html", html);
await writeFile("dist/critical.css", css);
```

**An SPA where the shell is empty until JS runs:**

```js
await critical({ src: "dist/index.html", engine: "render", inline: true });
// auto-routing would also pick "render" here; pinning it just skips the sniff.
```

## Design principles

- **Two engines, automatically routed.** The fast path runs whenever the delivered DOM is the
  source of truth; the browser is used only when it's actually needed.
- **Platform-first, few dependencies.** Three runtime dependencies — `lightningcss` (parse +
  minify + dead-code), `linkedom` (DOM), `css-tree` (rule walking). Everything else is a Node
  built-in (`fetch`, `parseArgs`, `styleText`, `fs.glob`). Heavy capabilities (`playwright`, the
  MCP SDK) are optional peers, imported lazily — you only pay for what you use.
- **Deterministic and explainable.** Stable output bytes and a structured `report` that says
  what ran, why, and what it saved.
- **Safe by default.** Nothing is written without an explicit flag; deferral adds no inline
  scripts, so the output works under a strict Content Security Policy.

## Requirements

- **Node.js ≥ 22.13**
- The **render engine** additionally needs `playwright` and a browser:
  `npm i -D playwright && npx playwright install chromium`. The static engine needs neither.

## Alternatives

Critical isn't the only way to inline critical CSS, and it isn't always the right one — a purely
prerendered site that just wants its used CSS inlined may be better served by a lighter,
browser-free tool. For a thorough, fair comparison of Critical, Beasties (formerly Critters),
Penthouse, and native platform approaches — including where each one is the better choice and a
reproducible benchmark — see [COMPARISON.md](./COMPARISON.md).

## License

[Apache-2.0](license) © Addy Osmani
