/**
 * MCP server — exposes Critical as a tool an agent can call directly.
 *
 *   npx critical mcp           # (wired via the bin in a real release)
 *   node src/mcp.js
 *
 * The point: an agent like Claude Code shouldn't have to shell out and parse stdout. It calls
 * `optimize_critical_css` with a path or HTML string and gets the structured report back as the
 * tool result — engine chosen, why, bytes saved, warnings — which it can reason about and act on.
 *
 * `@modelcontextprotocol/sdk` is an OPTIONAL peer dependency, imported lazily.
 */
import { critical } from "./index.js";

const TOOL = {
  name: "optimize_critical_css",
  description:
    "Extract above-the-fold critical CSS for an HTML document and (optionally) inline it, " +
    "deferring the rest. Auto-selects a no-browser static engine for rendered/SSG/SSR HTML or a " +
    "real-browser render engine for SPA shells. Returns the critical CSS, the rewritten HTML, and " +
    "a structured report explaining the engine choice and bytes saved.",
  inputSchema: {
    type: "object",
    properties: {
      src: { type: "string", description: "Path or URL to an HTML file. Provide this OR html." },
      html: { type: "string", description: "Raw HTML source. Provide this OR src." },
      css: {
        type: "array",
        items: { type: "string" },
        description: "Optional explicit CSS file paths/globs/strings.",
      },
      engine: {
        type: "string",
        enum: ["auto", "static", "render"],
        default: "auto",
        description:
          "Engine selection. 'auto' picks static for rendered HTML, render for SPA shells.",
      },
      inline: {
        type: "boolean",
        default: true,
        description: "Inline critical CSS and defer the rest.",
      },
      width: { type: "number", default: 1300 },
      height: { type: "number", default: 900 },
    },
  },
};

export async function createServer() {
  const { Server } = await loadSdk("server/index.js");
  const { CallToolRequestSchema, ListToolsRequestSchema } = await loadSdk("types.js");

  const server = new Server(
    { name: "critical", version: "9.0.0-next.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [TOOL] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL.name) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const args = request.params.arguments ?? {};
    const res = await critical({ inline: true, ...args });
    return {
      content: [
        { type: "text", text: JSON.stringify(res.report, null, 2) },
        { type: "text", text: res.html },
      ],
      // structuredContent lets a capable client consume the report without re-parsing text
      structuredContent: res.report,
    };
  });

  return server;
}

async function loadSdk(subpath) {
  try {
    return await import(`@modelcontextprotocol/sdk/${subpath}`);
  } catch {
    throw new Error(
      "The MCP server needs @modelcontextprotocol/sdk (optional peer dependency).\n" +
        "Install it:  npm i @modelcontextprotocol/sdk",
    );
  }
}

// Allow `node src/mcp.js` to start a stdio server directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { StdioServerTransport } = await loadSdk("server/stdio.js");
  const server = await createServer();
  await server.connect(new StdioServerTransport());
}
