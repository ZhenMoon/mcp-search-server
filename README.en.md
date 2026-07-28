# MCP Search Server

Multi-engine aggregated search MCP server with 7 search engines, automatic deduplication, spam filtering, and web page content extraction.

[中文文档](./README.md)

---

## Features

- **Multi-engine Parallel** — Simultaneously queries multiple search engines; `Promise.allSettled` ensures a single engine failure doesn't affect the overall result
- **Automatic Deduplication** — URL normalization + Jaccard similarity on titles/descriptions
- **Relevance Ranking** — Weighted scoring based on query term matches in titles, descriptions, and URLs
- **Spam Filtering** — Removes ads, navigation keywords, tracking parameters/domains, short descriptions, and error pages
- **Page Fetching** — Extracts readable content using Mozilla Readability; automatically removes duplicate paragraphs and copyright boilerplate
- **MCP Protocol** — Standard stdio transport, compatible with Cursor, Claude Desktop, Continue.dev, and other MCP clients
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

---

## Quick Start

### Install

```bash
git clone https://github.com/ZhenMoon/mcp-search-server.git
cd mcp-search-server
npm install
npm run build
```

### Configure MCP Client

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "mcp-search": {
      "command": "node",
      "args": ["<absolute-path>/mcp-search-server/build/index.js"]
    }
  }
}
```

**Claude Desktop** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "mcp-search": {
      "command": "node",
      "args": ["<absolute-path>/mcp-search-server/build/index.js"]
    }
  }
}
```

**Continue.dev** (`~/.continue/config.json`):
```json
{
  "experimental": {
    "mcpServers": {
      "mcp-search": {
        "command": "node",
        "args": ["<absolute-path>/mcp-search-server/build/index.js"]
      }
    }
  }
}
```

**Windsurf / Trae / Other MCP Clients** — Add the same `command`/`args` in your MCP configuration.

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SEARCH_ENGINES` | Comma-separated list of engines to enable | `bing,baidu,github` |
| `SEARCH_DISABLED_ENGINES` | Comma-separated list of engines to disable | `duckduckgo,brave` |

Default engines: `bing, sogou, baidu, github, zhihu` (5 engines).

---

## Available Tools

### `search`

Multi-engine aggregated search.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | required | Search keywords |
| `maxResults` | `number` | `10` | Max results (1–50) |
| `engines` | `string[]` | see above | Search engines to use |
| `timeout` | `number` | `15000` | Search timeout (ms) |

### `search_engines`

List all available search engines.

### `fetch`

Fetch and extract readable web page content.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | required | Page URL |
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
# Search + fetch workflow
search("Rust language tutorial", maxResults: 5)
  → returns 5 results
fetch(url: "https://doc.rust-lang.org/book/")
  → fetches and returns page content

# Specify engines
search(engines: ["bing", "github"], query: "nodejs cli tool")
  → only uses Bing and GitHub

# Environment variable to select engines
SEARCH_ENGINES=bing,github node build/index.js
```

---

## License

MIT
