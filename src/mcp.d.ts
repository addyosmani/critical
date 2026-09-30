/**
 * MCP server — exposes `critical` as a Model Context Protocol tool an agent can call directly.
 *
 * Requires the optional `@modelcontextprotocol/sdk` peer dependency.
 */
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CriticalOptions } from "./index.js";

/** Arguments accepted by the `optimize_critical_css` MCP tool. */
export interface OptimizeCriticalCssArgs {
  /** Path or URL to an HTML file. Provide this **or** `html`. */
  src?: string;
  /** Raw HTML source. Provide this **or** `src`. */
  html?: string;
  /** Optional explicit CSS file paths/globs/strings. */
  css?: string[];
  /**
   * Engine selection. `"auto"` picks static for rendered HTML, render for SPA shells.
   * @default "auto"
   */
  engine?: CriticalOptions["engine"];
  /**
   * Inline critical CSS and defer the rest.
   * @default true
   */
  inline?: boolean;
  /** Render-engine viewport width.
   * @default 1300
   */
  width?: number;
  /** Render-engine viewport height.
   * @default 900
   */
  height?: number;
}

/**
 * Start a Model Context Protocol server exposing the `optimize_critical_css` tool.
 *
 * @returns The MCP server instance. Connect it to a transport (e.g. `StdioServerTransport`) to serve.
 */
export function createServer(): Promise<Server>;
