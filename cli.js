#!/usr/bin/env node
/**
 * critical v9 CLI. Built on node:util parseArgs + node:util styleText — no meow, group-args,
 * picocolors, or indent-string. Designed to be pleasant for humans and trivial for agents:
 * zero-config directory input, `--json` for machine output, `--explain` for the routing rationale.
 */
import { parseArgs, styleText } from "node:util";
import { writeFile, stat, glob } from "node:fs/promises";
import { text } from "node:stream/consumers";
import path from "node:path";
import process from "node:process";
import { critical } from "./src/index.js";

const HELP = `
${styleText("bold", "critical")} — extract & inline critical-path CSS (two engines, auto-routed)

${styleText("bold", "Usage")}
  critical <input> [options]        input: a directory, an .html file, or stdin

${styleText("bold", "Options")}
  -e, --engine <auto|static|render>  engine selection            (default: auto)
  -i, --inline                       inline critical CSS + defer the rest
  -w, --width <px>                   render-engine viewport width  (default: 1300)
  -h, --height <px>                  render-engine viewport height (default: 900)
      --dimensions <WxH,WxH>         multiple render viewports
      --no-fold                      ignore [data-critical-fold] scoping (static)
      --no-minify                    keep critical CSS readable
  -o, --out <file|dir>               write result (default: stdout)
      --write                        rewrite inputs in place (with --inline)
      --json                         emit the structured result as JSON
      --explain                      print which engine ran and why
      --help                         show this help

${styleText("bold", "Examples")}
  critical ./dist --inline --write           optimize a build dir in place
  critical index.html --explain              see the routing decision
  critical app.html -e render -i > out.html  force a real-browser pass for an SPA
  cat page.html | critical --inline          stdin -> stdout
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      engine: { type: "string", short: "e", default: "auto" },
      inline: { type: "boolean", short: "i", default: false },
      width: { type: "string", short: "w" },
      height: { type: "string", short: "h" },
      dimensions: { type: "string" },
      fold: { type: "boolean", default: true },
      minify: { type: "boolean", default: true },
      out: { type: "string", short: "o" },
      write: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      explain: { type: "boolean", default: false },
      help: { type: "boolean" },
    },
  });

  if (values.help) return void process.stdout.write(HELP + "\n");

  const base = {
    engine: values.engine,
    inline: values.inline,
    minify: values.minify,
    foldAware: values.fold,
    ...(values.width ? { width: Number(values.width) } : {}),
    ...(values.height ? { height: Number(values.height) } : {}),
    ...(values.dimensions ? { dimensions: parseDimensions(values.dimensions) } : {}),
  };

  const inputs = await resolveInputs(positionals);

  for (const input of inputs) {
    const opts = input.src ? { ...base, src: input.src } : { ...base, html: input.html };
    const res = await critical(opts);
    await emit(res, input, values);
  }
}

async function resolveInputs(positionals) {
  // No positional -> read stdin.
  if (positionals.length === 0) {
    if (process.stdin.isTTY) {
      process.stdout.write(HELP + "\n");
      process.exit(0);
    }
    return [{ html: await text(process.stdin), label: "<stdin>" }];
  }

  const inputs = [];
  for (const p of positionals) {
    const s = await stat(p).catch(() => null);
    if (s?.isDirectory()) {
      for await (const file of glob("**/*.html", { cwd: p })) {
        inputs.push({ src: path.join(p, file), label: path.join(p, file) });
      }
    } else {
      inputs.push({ src: p, label: p });
    }
  }
  if (inputs.length === 0) fail(`No HTML found in: ${positionals.join(", ")}`);
  return inputs;
}

async function emit(res, input, values) {
  if (values.explain) {
    const r = res.report;
    const line = `${styleText("cyan", input.label)}  ${styleText("bold", r.engine)}  ${r.reason}`;
    process.stderr.write(line + "\n");
    const stats = `  rules ${r.rules.kept}/${r.rules.total}  critical ${fmt(r.bytes.critical)}  from ${fmt(r.bytes.stylesheets)}  ${r.durationMs}ms`;
    process.stderr.write(styleText("dim", stats) + "\n");
    for (const w of r.warnings) process.stderr.write(styleText("yellow", `  ⚠ ${w}`) + "\n");
  }

  if (values.json) {
    process.stdout.write(JSON.stringify({ input: input.label, ...res.report }, null, 2) + "\n");
    return;
  }

  const payload = values.inline ? res.html : res.css;

  if (values.write && input.src && values.inline) {
    await writeFile(input.src, res.html);
    if (!values.explain) process.stderr.write(`${styleText("green", "✓")} ${input.label}\n`);
    return;
  }

  if (values.out) {
    const dest = (await isDir(values.out))
      ? path.join(values.out, path.basename(input.label))
      : values.out;
    await writeFile(dest, payload);
    return;
  }

  if (!values.explain) process.stdout.write(payload);
}

function parseDimensions(s) {
  return s.split(",").map((d) => {
    const [w, h] = d.toLowerCase().split("x").map(Number);
    return { width: w, height: h };
  });
}

const fmt = (n) => (n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`);
const isDir = async (p) => (await stat(p).catch(() => null))?.isDirectory() ?? false;
function fail(msg) {
  process.stderr.write(styleText("red", `Error: ${msg}`) + "\n");
  process.exit(1);
}

main().catch((error) => fail(error.message));
