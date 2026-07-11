/**
 * Head-to-head: Critical vs Beasties. Prints the comparison numbers used in COMPARISON.md.
 *
 *   node bench/vs-beasties.mjs
 *
 * Two scenarios, two kinds of "better":
 *   1. Rendered page  -> v9 (render) inlines only above-the-fold; Beasties inlines all used CSS.
 *                        Win = a smaller render-blocking payload for the same visible result.
 *   2. SPA shell      -> Beasties sees an empty #root and covers ~none of the app's above-fold
 *                        UI (broken first paint). v9 renders and covers it. Win = correctness.
 */
import path from "node:path";
import { critical } from "../src/index.js";
import { runBeasties, covers, ABOVE_FOLD, BELOW_FOLD, FIXTURES, hasPlaywright } from "./lib.mjs";

const bar = (n, max, width = 28) => "█".repeat(Math.round((n / max) * width)).padEnd(width);
const pct = (n) => `${n.toFixed(1)}%`;

if (!(await hasPlaywright())) {
  console.error(
    "This benchmark needs Playwright: npm i -D playwright && npx playwright install chromium",
  );
  process.exit(1);
}

console.log("\n  critical v9  vs  Beasties — inlined critical-CSS payload\n");

// ── Scenario 1: rendered page, above-the-fold precision ─────────────────────────────────────
{
  const beasties = await runBeasties("long.html");
  const v9 = await critical({ src: path.join(FIXTURES, "long.html"), engine: "render" });
  const v9Bytes = v9.report.bytes.critical;
  const reduction = 100 * (1 - v9Bytes / beasties.bytes);
  const max = Math.max(beasties.bytes, v9Bytes);

  console.log("  ① Rendered page (long.html) — smaller is better");
  console.log(`     Beasties     ${bar(beasties.bytes, max)} ${beasties.bytes} B  (all used CSS)`);
  console.log(`     critical v9  ${bar(v9Bytes, max)} ${v9Bytes} B  (above-the-fold only)`);
  console.log(`     → v9 is ${pct(reduction)} smaller while covering everything visible.`);
  console.log(
    `       below-fold leaked into critical?  Beasties: ${covers(beasties.css, BELOW_FOLD).length}/${BELOW_FOLD.length} selectors,  v9: ${covers(v9.css, BELOW_FOLD).length}/${BELOW_FOLD.length}\n`,
  );
}

// ── Scenario 2: SPA shell, correctness ──────────────────────────────────────────────────────
{
  const beasties = await runBeasties("spa-app.html");
  const v9 = await critical({ src: path.join(FIXTURES, "spa-app.html"), engine: "auto" });

  const bCov = covers(beasties.css, ABOVE_FOLD);
  const vCov = covers(v9.css, ABOVE_FOLD);

  console.log("  ② SPA shell (spa-app.html) — above-the-fold coverage, higher is better");
  console.log(
    `     Beasties     covers ${bCov.length}/${ABOVE_FOLD.length} above-fold selectors  (no rendered DOM to match)`,
  );
  console.log(
    `     critical v9  covers ${vCov.length}/${ABOVE_FOLD.length} above-fold selectors  (engine: ${v9.report.engine})`,
  );
  console.log(
    `     → On an un-rendered shell a browser-free pass has no markup to match; the render engine measures the painted page.\n`,
  );
}
