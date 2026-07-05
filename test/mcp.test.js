/**
 * MCP server tests. Wires an in-memory client<->server pair from the MCP SDK and drives the
 * server the way an agent would: list the tool, then call `optimize_critical_css` and assert the
 * structured report comes back. Static input only — no browser. Skips if the optional
 * @modelcontextprotocol/sdk peer dependency isn't installed.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

const hasSdk = await import("@modelcontextprotocol/sdk/server/index.js").then(
  () => true,
  () => false,
);

// Real markup so routing stays static (never launches a browser under test).
const HTML =
  "<!doctype html><html><head><style>.hero{color:red}.dead{color:blue}</style></head><body>" +
  '<header class="hero"><h1>Above the fold heading</h1></header>' +
  "<main><p>Rendered body content here.</p></main></body></html>";

describe("MCP server", { skip: !hasSdk && "requires @modelcontextprotocol/sdk" }, () => {
  let client;

  before(async () => {
    const { createServer } = await import("../src/mcp.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");

    const server = await createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0.0.0" }, { capabilities: {} });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  test("exposes the optimize_critical_css tool", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "optimize_critical_css");
    assert.ok(tool, "optimize_critical_css tool not listed");
    assert.match(tool.description, /critical CSS/i);
  });

  test("calling the tool returns the structured report", async () => {
    const result = await client.callTool({
      name: "optimize_critical_css",
      arguments: { html: HTML, inline: true },
    });

    // structuredContent carries the report verbatim for capable clients.
    assert.equal(result.structuredContent.engine, "static");
    assert.ok(result.structuredContent.bytes.critical > 0);

    // First text block is the JSON report; second is the rewritten HTML.
    const report = JSON.parse(result.content[0].text);
    assert.equal(report.engine, "static");
    assert.match(result.content[1].text, /<style data-critical/); // inlined by default
  });

  test("keeps used rules and drops unused ones through the tool", async () => {
    const result = await client.callTool({
      name: "optimize_critical_css",
      arguments: { html: HTML, inline: false },
    });
    const [, htmlBlock] = result.content;
    // With inline:false the returned html equals the input; the critical CSS is what we check.
    assert.match(htmlBlock.text, /<h1>/);
    assert.equal(result.structuredContent.rules.kept < result.structuredContent.rules.total, true);
  });

  test("rejects an unknown tool name", async () => {
    await assert.rejects(
      () => client.callTool({ name: "not_a_tool", arguments: {} }),
      /Unknown tool/,
    );
  });
});
