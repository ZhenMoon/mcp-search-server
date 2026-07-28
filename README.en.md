# MCP Search Server

[中文文档](./README.md) | English

<div align="center">

Multi-engine aggregated search MCP server — **7 search engines** in parallel, deduplication, spam filtering, relevance ranking, and web page content extraction.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

Compatible with **Cursor** · **Claude Desktop** · **Continue.dev** · **Windsurf** · **Trae**

</div>

---

## Table of Contents

- [Features](#features)
- [Search Engines](#search-engines)
- [Quick Start](#quick-start)
- [Client Configuration](#client-configuration)
- [Environment Variables](#environment-variables)
- [Available Tools](#available-tools)
- [Project Structure](#project-structure)
- [Usage Examples](#usage-examples)

---

## Features

- **Multi-engine Parallel** — Queries multiple engines simultaneously; `Promise.allSettled` ensures a single engine failure doesn't affect the overall result
- **Automatic Deduplication** — URL normalization + Jaccard similarity on titles and descriptions
- **Relevance Ranking** — Weighted scoring based on query term matches in titles, descriptions, and URLs; zero-match results are automatically filtered out
- **Spam Filtering** — Removes ads, navigation keywords, tracking parameters/domains, short descriptions, and error pages
- **Page Fetching** — Extracts readable content using Mozilla Readability; automatically removes duplicate paragraphs, copyright notices, and tail recommendations
- **MCP Protocol** — Standard stdio transport, works out of the box
- **Configurable** — Choose which engines to enable via environment variables

---

## Search Engines

| Engine | Type | Notes |
|--------|------|-------|
| `bing` | General | Microsoft Bing, good for Chinese queries |
| `sogou` | General | Sogou Search |
| `baidu` | General | Baidu Search |
| `duckduckgo` | General | DuckDuckGo (may be blocked in China) |
| `brave` | General | Brave Search (may be blocked in China) |
| `github` | Code | GitHub repository search |
| `zhihu` | Content | Zhihu Q&A (via Bing `site:` search) |

Default engines: `bing` `sogou` `baidu` `github` `zhihu`

---

## Quick Start

```bash
git clone https://github.com/ZhenMoon/mcp-search-server.git
cd mcp-search-server
npm install
npm run build
```

---

## Client Configuration

Add the following entry to your MCP client config (replace `<path>` with your actual path):

```json
{
  "mcpServers": {
    "mcp-search": {
      "command": "node",
      "args": ["<path>/mcp-search-server/build/index.js"]
    }
  }
}
```

**Config file locations:**

| Client | Config Path |
|--------|-------------|
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop | `~/.claude/settings.json` |
| Continue.dev | `~/.continue/config.json` |
| Windsurf / Trae | Add the same `command`/`args` to MCP settings |

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SEARCH_ENGINES` | Comma-separated list of engines to enable | `bing,baidu,github` |
| `SEARCH_DISABLED_ENGINES` | Comma-separated list of engines to disable | `duckduckgo,brave` |

---

## Available Tools

### `search` — Multi-engine aggregated search

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Search keywords |
| `maxResults` | `number` | `10` | Max results (1–50) |
| `engines` | `string[]` | 5 engines | Search engines to use |
| `timeout` | `number` | `15000` | Search timeout (ms) |

### `search_engines` — List available engines

No parameters.

### `fetch` — Fetch and extract page content

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | **required** | Page URL |
| `timeout` | `number` | `15000` | Fetch timeout (ms) |
| `maxLength` | `number` | `8000` | Max content length to return |

---

## Project Structure

```
mcp-search-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # Type definitions
│   ├── aggregator.ts         # Multi-engine aggregation & relevance scoring
│   ├── dedup.ts              # Search result deduplication
│   ├── dedupContent.ts       # Page content deduplication
│   ├── filter.ts             # Spam filtering
│   ├── fetcher.ts            # Page fetching (Readability)
│   └── engines/
│       ├── bing.ts           # Bing
│       ├── sogou.ts          # Sogou
│       ├── baidu.ts          # Baidu
│       ├── duckduckgo.ts     # DuckDuckGo
│       ├── brave.ts          # Brave Search
│       ├── github.ts         # GitHub
│       └── zhihu.ts          # Zhihu
├── package.json
├── tsconfig.json
├── README.md                 # Chinese documentation
└── README.en.md              # English documentation
```

---

## Usage Examples

```text
Search + fetch workflow:
  search("Rust language tutorial", maxResults: 5)
  fetch("https://doc.rust-lang.org/book/")

Specify engines:
  search(engines: ["bing", "github"], query: "nodejs cli tool")

Environment variable:
  SEARCH_ENGINES=bing,github node build/index.js
```

---

## License

MIT
