# Critical and the alternatives

There are several good tools for inlining critical-path CSS. They make different trade-offs, and
the best choice depends on how your site is built and rendered. This document compares them
honestly — including where Critical is **not** the right pick — and shows a reproducible
benchmark with its caveats.

If you just want a recommendation, jump to [Which should I use?](#which-should-i-use).

## The tools

- **[Critical](https://github.com/addyosmani/critical)** — extracts and inlines above-the-fold
  CSS. Uses two engines: a browser-free _static_ engine that matches used CSS against the
  delivered DOM, and a _render_ engine that measures a real viewport in a headless browser. It
  routes between them automatically.
- **[Beasties](https://github.com/danielroe/beasties)** — the actively maintained successor to
  Google Chrome Labs' Critters (now archived). Inlines critical CSS **without** a headless
  browser by reconstructing the delivered DOM and keeping the CSS it uses. Lightweight, fast, and
  integrated into several frameworks (it's the engine behind Next.js's `optimizeCss`, and has
  Nuxt / webpack / Vite plugins).
- **[Penthouse](https://github.com/pocketjoso/penthouse)** — the original headless-browser
  critical-CSS engine (and the engine Critical used internally through v8). Accurate and
  viewport-aware, but lower level: you supply the CSS and a URL/HTML; it doesn't discover
  stylesheets or inline for you.
- **Native / build-tool approaches** — CSS code-splitting (per-route CSS in Vite/Next/Astro),
  `content-visibility`, and shipping less CSS overall (e.g. Tailwind's generated output) reduce
  how much critical-CSS tooling you need in the first place.

## At a glance

|                                             | Critical                              | Beasties                               | Penthouse                          |
| ------------------------------------------- | ------------------------------------- | -------------------------------------- | ---------------------------------- |
| Headless browser required                   | Only for the render engine (optional) | No                                     | Yes                                |
| Viewport-aware (true above-the-fold)        | Yes (render engine)                   | No — inlines all _used_ CSS            | Yes                                |
| Handles un-rendered SPA shells              | Yes (render engine)                   | No (needs rendered HTML)               | Yes, if given the rendered page    |
| Discovers stylesheets from HTML             | Yes                                   | Yes                                    | No (you supply CSS)                |
| Inlines + defers the rest for you           | Yes                                   | Yes                                    | No                                 |
| Speed on prerendered HTML                   | Fast (static engine)                  | Fastest                                | Slower (always launches a browser) |
| Runtime dependencies                        | 3 (+ optional Playwright)             | Small                                  | Larger (bundles Puppeteer)         |
| Framework plugins (webpack/Vite/Nuxt/Next)  | Not yet                               | Yes                                    | Via wrappers                       |
| Maturity / ecosystem                        | Long-standing                         | Actively maintained, widely integrated | Long-standing, stable              |
| Structured/JSON output for tooling & agents | Yes                                   | No                                     | No                                 |

None of these rows is a verdict on its own — they're trade-offs. The two that matter most in
practice are **viewport-awareness** and **whether a browser is involved**, and they pull in
opposite directions.

## The core trade-off

**Beasties' design choice — no headless browser — is a genuine strength.** It's fast,
lightweight, dependency-light, runs anywhere (including serverless build steps), and is an
excellent fit for statically generated and server-rendered sites. For a prerendered page where
you simply want the _used_ CSS inlined and the rest deferred, it's hard to beat, and its
framework integrations make it nearly zero-config.

The same choice has two consequences:

1. **It isn't viewport-aware.** Without a browser there's no fold, so Beasties inlines _all_ the
   CSS the document uses — including styles for content far below the fold. For long pages this
   makes the inlined (render-blocking) payload larger than the truly-critical set. Beasties
   offers `data-beasties-container` to manually mark a fold region, which recovers some of this
   when you're willing to annotate your markup.
2. **It needs rendered HTML.** It reconstructs the DOM from the HTML you give it. If that HTML is
   a single-page-app shell (`<div id="root"></div>` with the UI rendered later by JavaScript),
   there's little markup to match against, so little app CSS is considered critical. The fix is to
   prerender/SSR the page first and run Beasties on that output.

**Critical takes the opposite default and tries to remove the trade-off.** It runs a comparable
browser-free path (the static engine) when the delivered DOM is the source of truth, and falls
back to a real browser (the render engine) when viewport accuracy matters or when the page is an
un-rendered shell — choosing between them automatically. The cost is that the render engine needs
Playwright and is slower than a pure static pass; if your pages are always fully prerendered and
you don't need viewport precision, that machinery is more than you need.

## Benchmark

`npm run bench` runs Critical and Beasties over identical fixtures and measures the **inlined
critical-CSS payload** — the render-blocking bytes placed in `<head>`, which is what affects
first paint and LCP.

```
① Rendered page (long.html) — smaller is better
   Beasties     2770 B   (all used CSS, incl. footer / FAQ / pricing)
   Critical     1003 B   (above-the-fold only, render engine)
   → 63.8% smaller, with no below-the-fold CSS in the critical set,
     while still covering every above-the-fold selector.

② SPA shell (spa-app.html) — above-the-fold coverage, higher is better
   Beasties     covers 0/4 above-fold selectors   (empty #root, nothing to match)
   Critical     covers 4/4 above-fold selectors    (render engine)
```

### What this shows, and what it doesn't

- **Scenario ① is about precision.** Because Critical's render engine knows where the fold is, it
  excludes below-the-fold CSS that a used-CSS approach inlines. On this fixture that's ~64%
  fewer render-blocking bytes. **This number is fixture-dependent**: it scales with how much of a
  page lives below the fold. A short, mostly-above-the-fold page would show a much smaller gap —
  possibly none. The robust, general claim is _structural_: Critical's render engine never inlines
  below-the-fold CSS, so its critical payload doesn't grow with page length the way a used-CSS
  payload does.
- **Scenario ② is about correctness on SPAs.** Beasties is doing exactly what it's designed to do;
  it simply isn't designed to render an empty shell. Run on prerendered/SSR output of the same
  app, Beasties would cover the above-the-fold CSS well. The honest comparison is: _on
  un-rendered shells_, Critical's render engine produces a correct result and a browser-free tool
  cannot.
- **This is one fixture pair, not a corpus.** A rigorous evaluation would span Tailwind output, CSS
  modules, a docs site, a marketing page, and a real SPA, and report the distribution. Treat the
  numbers as an illustration of the mechanism, not a universal "X% better."

Both outcomes are encoded as regression tests (`test/vs-beasties.test.js`) so they stay honest as
the code changes.

## Which should I use?

- **Statically generated / server-rendered site, want it simple and fast:** Beasties is an
  excellent default, especially if your framework already integrates it (e.g. Next.js
  `optimizeCss`). If you don't need viewport precision, you may not need anything heavier.
- **You want a tight, viewport-accurate critical set, or you ship long pages** where below-the-fold
  CSS bloats the inlined payload: Critical's render engine targets exactly that.
- **A single-page app whose HTML is an empty shell at build time:** prerender/SSR it and use any
  tool — or use Critical's render engine to measure the app as a browser paints it, without a
  separate prerender step.
- **You already have the CSS and a rendered page and want a low-level, browser-based extractor:**
  Penthouse.
- **You're orchestrating this from a build script or an agent** and want a structured, explainable
  result (which engine ran, bytes saved, warnings) rather than just a file: Critical emits that by
  design (`--json`, the `report` object, and an MCP server).

Critical and Beasties also aren't mutually exclusive across a project: you can run the fast
browser-free path on prerendered routes and reserve the render engine for the handful of routes
that genuinely need it. Critical's automatic routing is one way to get that split without wiring
it up yourself.

---

_Comparisons reflect the tools as of 2026 and are written to be fair; corrections via PR are
welcome. Benchmark methodology lives in `bench/vs-beasties.mjs`._
