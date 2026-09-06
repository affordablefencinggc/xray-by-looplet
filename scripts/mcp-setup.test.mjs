import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findPython, generateMcpConfigs, AGENTS_MCP, CURSOR_MCP } from "./mcp-setup.mjs";

describe("MCP Setup & Configuration", () => {
  test("finds a working Python executable", () => {
    const py = findPython();
    assert.ok(py, "Python executable should be identified");
  });

  test("generates valid configuration schemas for all clients", () => {
    const py = "python";
    const { cursorAndClaude, antigravity, localStdioConfig } = generateMcpConfigs(py);

    assert.equal(localStdioConfig.command, "python");
    assert.deepEqual(localStdioConfig.args, ["-m", "engine.server.mcp_server"]);
    assert.ok(localStdioConfig.env.PYTHONPATH.includes("engine"));

    // Verify Cursor schema
    assert.ok(cursorAndClaude.mcpServers["xray-by-looplet"]);
    assert.equal(cursorAndClaude.mcpServers["looplet-crm"].url, "https://mcp.looplet.com.au/mcp");

    // Verify Antigravity schema
    assert.ok(antigravity.mcpServers["xray-by-looplet"]);
    assert.equal(antigravity.mcpServers["looplet-crm"].serverUrl, "https://mcp.looplet.com.au/mcp");
  });

  test("writes valid JSON files to .agents/mcp_config.json and .cursor/mcp.json", () => {
    assert.ok(existsSync(AGENTS_MCP), ".agents/mcp_config.json should exist");
    assert.ok(existsSync(CURSOR_MCP), ".cursor/mcp.json should exist");

    const agy = JSON.parse(readFileSync(AGENTS_MCP, "utf8"));
    assert.ok(agy.mcpServers["xray-by-looplet"]);
    assert.ok(agy.mcpServers["looplet-crm"]);
    assert.equal(agy.mcpServers["looplet-crm"].serverUrl, "https://mcp.looplet.com.au/mcp");

    const cursor = JSON.parse(readFileSync(CURSOR_MCP, "utf8"));
    assert.ok(cursor.mcpServers["xray-by-looplet"]);
    assert.ok(cursor.mcpServers["looplet-crm"]);
  });
});
