# MCP Search Server

[中文文档](./README.md) | English

<div align="center">

Local multi-engine aggregated search MCP server — **8 engines parallel** + **dedup/ranking** + **page fetch** + **deep research**.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

Compatible with **Cursor** · **Claude Desktop** · **Continue.dev** · **Windsurf** · **Trae**

**Privacy-first** · **Zero API cost** · **Fully open source** · **On-premises deployable**

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

- **Multi-engine Parallel** — Queries 8 engines simultaneously; `Promise.allSettled` ensures single engine failure doesn't affect overall result
- **Deep Research** — `research` does search → fetch → per-page summary → conclusion in one step
- **Composite Tools** — `search_and_fetch` fetches pages alongside search results
- **Search Sessions** — Persistent results, `refine` for secondary filtering (engine/keyword/domain/pagination)
- **Search Profiles** — `profile` parameter: general / tech / chinese / code / fast / deep
- **Result Aggregation** — Cross-engine deduplication (URL + title similarity), relevance scoring, engine-balanced output
- **Query Expansion** — Automatic synonym expansion when results are scarce, improving recall
- **Spam Filtering** — Removes ads, navigation keywords, tracking parameters/domains, short descriptions, and error pages
- **Page Fetching** — Mozilla Readability content extraction, auto-removes duplicates, copyright notices, and tail recommendations
- **Disk Cache** — 5-minute TTL, sub-second response for repeated queries
- **Circuit Breaker** — Automatic 30s cooldown after consecutive engine failures, full reset on success
- **MCP Protocol** — Standard stdio transport, works with Cursor/Claude Desktop out of the box
- **Privacy-first** — Fully local, search history never leaves your machine
- **Zero API Cost** — Uses free search engines directly, no paid API required
- **Anti-scraping** — UA rotation, randomized headers, pagination jitter, universal challenge detection
- **Headless Browser** — Set `HEADLESS_BROWSER=true` to enable Puppeteer; Zhihu engine uses direct search, bypassing 403 restrictions
- **Configurable** — Choose which engines to enable via environment variables

---

## Search Engines

| Engine | Type | Notes |
|--------|------|-------|
| `bing` | General | Microsoft Bing, good for Chinese queries |
| `baidu` | General | Baidu Search |
| `360` | General | 360 Search (so.com), accessible from China |
| `sogou` | General | Sogou Search (aggressive anti-scraping) |
| `duckduckgo` | General | DuckDuckGo (may be blocked in China) |
| `brave` | General | Brave Search (may be blocked in China) |
| `github` | Code | GitHub repository search |
| `zhihu` | Content | Zhihu Q&A (via Bing `site:` search) |

Default engines: `bing` `baidu` `360` `github` `zhihu`

> For users in China: sogou / duckduckgo / brave may be unreliable. Use `SEARCH_DISABLED_ENGINES` to disable them.

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
| `SEARCH_ENGINES` | Comma-separated list of engines to enable | `bing,baidu,360` |
| `SEARCH_DISABLED_ENGINES` | Comma-separated list of engines to disable | `duckduckgo,brave,sogou` |
| `HEADLESS_BROWSER` | Enable headless browser (requires Chrome/Edge) | `true` |
| `CHROME_DEBUG_URL` | Connect to existing Chrome (e.g. `http://127.0.0.1:9222`), start Chrome with `--remote-debugging-port=9222` | — |
| `BRAVE_API_KEY` | Brave Search API key (free 1000 req/month) | Get at https://brave.com/search/api/ |

When `HEADLESS_BROWSER=true`, the Zhihu engine uses Puppeteer for direct search (instead of Bing `site:`), yielding higher quality results.
Setting `CHROME_DEBUG_URL` connects to your running Chrome, sharing cookies and login sessions to bypass captchas.
Setting `BRAVE_API_KEY` enables the Brave official API, providing reliable international results even from restricted networks.

```bash
SEARCH_DISABLED_ENGINES=duckduckgo,brave,sogou node build/index.js
```

---

## Available Tools

### `search` — Multi-engine aggregated search

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Search keywords |
| `maxResults` | `number` | `10` | Max results (1–50) |
| `engines` | `string[]` | 5 engines | Search engines to use |
| `timeout` | `number` | `15000` | Search timeout (ms) |
| `profile` | `string` | — | Search profile: `general`/`tech`/`chinese`/`code`/`fast`/`deep` |

Returns a `【Session ID】` for use with the `refine` tool.

### `refine` — Refine search results

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | **required** | Session ID from `search` |
| `engine` | `string` | — | Filter by engine (comma-separated) |
| `keyword` | `string` | — | Filter by keyword |
| `domain` | `string` | — | Filter by domain |
| `offset` | `number` | `0` | Offset |
| `limit` | `number` | `10` | Max items to return |

### `search_profiles` — List available search profiles

No parameters.

### `search_engines` — List available engines

No parameters.

### `fetch` — Fetch and extract page content

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | **required** | Page URL |
| `timeout` | `number` | `15000` | Fetch timeout (ms) |
| `maxLength` | `number` | `8000` | Max content length to return |

### `search_and_fetch` — Search + fetch page content

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Search keywords |
| `maxResults` | `number` | `5` | Max results |
| `fetchCount` | `number` | `3` | Fetch top N pages |
| `engines` | `string[]` | 5 engines | Search engines |
| `timeout` | `number` | `15000` | Timeout (ms) |
| `profile` | `string` | — | Search profile |

### `research` — Deep research (search → fetch → report)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Research topic |
| `maxResults` | `number` | `8` | Max results |
| `fetchCount` | `number` | `3` | Deep-read top N |
| `engines` | `string[]` | 5 engines | Search engines |
| `timeout` | `number` | `20000` | Timeout (ms) |

---

## Project Structure

```
mcp-search-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # Type definitions
│   ├── aggregator.ts         # Multi-engine aggregation, dedup, scoring
│   ├── browser.ts            # Headless browser manager
│   ├── cache.ts              # Disk cache (TTL 5min)
│   ├── circuitBreaker.ts     # Engine circuit breaker
│   ├── dedupContent.ts       # Page content deduplication
│   ├── filter.ts             # Spam filtering
│   ├── queryExpander.ts      # Synonym query expansion
│   ├── queryAdapter.ts       # Engine-specific query adaptation
│   ├── fetcher.ts            # Page fetching (Readability)
│   ├── scraper.ts            # Anti-scraping utilities
│   ├── searchContext.ts      # Search session management
│   ├── session.ts            # Cookie session management
│   └── engines/
│       ├── bing.ts           # Bing
│       ├── baidu.ts          # Baidu
│       ├── 360.ts            # 360 Search
│       ├── sogou.ts          # Sogou
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
