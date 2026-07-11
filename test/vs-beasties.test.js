/**
 * Regression guard for the Critical-vs-Beasties benchmark in COMPARISON.md: the render engine's
 * critical payload stays meaningfully smaller on long pages (it excludes below-the-fold CSS), and
 * it covers above-the-fold CSS on un-rendered SPA shells. Skips when Beasties/Playwright absent.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { critical } from "../src/index.js";
import {
  runBeasties,
  covers,
  ABOVE_FOLD,
  BELOW_FOLD,
  FIXTURES,
  hasBeasties,
  hasPlaywright,
} from "../bench/lib.mjs";

const notReady = !((await hasBeasties()) && (await hasPlaywright()));

/** The headline number. We assert ≥20%; the prototype currently delivers ~64%. */
const MIN_REDUCTION = 0.2;

describe("critical v9 vs Beasties", { skip: notReady && "requires beasties + playwright" }, () => {
  test(`rendered page: critical payload is ≥${MIN_REDUCTION * 100}% smaller than Beasties`, async () => {
    const beasties = await runBeasties("long.html");
    const v9 = await critical({ src: path.join(FIXTURES, "long.html"), engine: "render" });
    const v9Bytes = v9.report.bytes.critical;

    const reduction = 1 - v9Bytes / beasties.bytes;
    assert.ok(
      reduction >= MIN_REDUCTION,
      `expected ≥${MIN_REDUCTION * 100}% smaller, got ${(reduction * 100).toFixed(1)}% (v9 ${v9Bytes}B vs Beasties ${beasties.bytes}B)`,
    );

    // …and the reason it's smaller: v9 doesn't leak below-the-fold CSS into the critical set.
    assert.equal(covers(v9.css, BELOW_FOLD).length, 0, "v9 leaked below-fold CSS");
    assert.ok(
      covers(beasties.css, BELOW_FOLD).length > 0,
      "fixture invalid: Beasties should inline below-fold CSS",
    );

    // Same visible result: every above-the-fold selector is still present.
    assert.equal(
      covers(v9.css, ABOVE_FOLD).length,
      ABOVE_FOLD.length,
      "v9 dropped an above-fold selector",
    );
  });

  test("SPA shell: v9 covers above-the-fold UI that Beasties misses entirely", async () => {
    const beasties = await runBeasties("spa-app.html");
    const v9 = await critical({ src: path.join(FIXTURES, "spa-app.html"), engine: "auto" });

    const beastiesCoverage = covers(beasties.css, ABOVE_FOLD).length;
    const v9Coverage = covers(v9.css, ABOVE_FOLD).length;

    assert.equal(beastiesCoverage, 0, "Beasties unexpectedly saw the rendered app");
    assert.equal(v9Coverage, ABOVE_FOLD.length, "v9 should cover the full above-the-fold set");
    assert.ok(v9Coverage > beastiesCoverage);
  });
});
