# MCP Search Server

[中文文档](./README.md) | English

<div align="center">

Multi-engine aggregated search MCP server — **7 engines parallel** + **AI semantic dedup/rerank** + **page fetch** + **deep research**.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Xenova](https://img.shields.io/badge/AI-Transformers.js-orange)](https://huggingface.co/Xenova)

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

- **Multi-engine Parallel** — Queries 7 engines simultaneously; `Promise.allSettled` ensures single engine failure doesn't affect overall result
- **AI Semantic Dedup** (optional) — Jina-Embeddings-v2 cosine similarity dedup, replacing traditional Jaccard
- **AI Re-ranking** (optional) — BGE-Reranker-v2-m3 Cross-encoder relevance scoring
- **AI Summarization** — DistilBART-CNN for article summarization (`summarize` / `fetch_and_summarize`)
- **Deep Research** — `research` does search → fetch → per-page summary → conclusion in one step
- **Composite Tools** — `search_and_fetch` fetches pages alongside search results
- **Search Sessions** — Persistent results, `refine` for secondary filtering (engine/keyword/domain/pagination)
- **Search Profiles** — `profile` parameter: general / tech / chinese / code / fast / deep
- **Spam Filtering** — Removes ads, navigation keywords, tracking parameters/domains, short descriptions, and error pages
- **Page Fetching** — Mozilla Readability content extraction, auto-removes duplicates, copyright notices, and tail recommendations
- **MCP Protocol** — Standard stdio transport, works with Cursor/Claude Desktop out of the box
- **Privacy-first** — Fully local, search history never leaves your machine
- **Zero API Cost** — Uses free search engines directly, no paid API required
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

### `summarize` — AI summarization (DistilBART-CNN)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | `string` | **required** | Text to summarize (min 50 chars) |
| `maxLength` | `number` | `150` | Max summary length |

### `neural` — AI model status

No parameters. Shows load status for embedding, reranker, and summarizer models.

---

## Composite Tools

### `search_and_fetch` — Search + fetch page content

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Search keywords |
| `maxResults` | `number` | `5` | Max results |
| `fetchCount` | `number` | `3` | Fetch top N pages |
| `engines` | `string[]` | 5 engines | Search engines |
| `timeout` | `number` | `15000` | Timeout (ms) |
| `profile` | `string` | — | Search profile |
| `useNeural` | `boolean` | `false` | Enable AI dedup+rerank |

### `fetch_and_summarize` — Fetch + AI summarization

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | **required** | Page URL |
| `timeout` | `number` | `15000` | Fetch timeout (ms) |
| `summaryMaxLength` | `number` | `150` | Max summary length |

### `research` — Deep research (search → fetch → report)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | **required** | Research topic |
| `maxResults` | `number` | `8` | Max results |
| `fetchCount` | `number` | `3` | Deep-read top N |
| `engines` | `string[]` | 5 engines | Search engines |
| `timeout` | `number` | `20000` | Timeout (ms) |
| `useNeural` | `boolean` | `false` | Enable AI dedup+rerank |

---

## AI Models

Models are downloaded from Hugging Face on first use (~1.2GB cache):

| Purpose | Model | Size | Notes |
|---------|-------|------|-------|
| Semantic dedup | Jina-Embeddings-v2 (300M) | ~120MB | Cosine similarity > 0.85 merge |
| Reranking | BGE-Reranker-v2-m3 (500M) | ~500MB | Cross-encoder relevance sorting |
| Summarization | DistilBART-CNN (400M) | ~400MB | AI-generated summaries |

Enable via `search(query, useNeural: true)`.
Use `summarize(text)` for direct AI summarization.
Set `PRELOAD_MODELS=1` to warm up models on server start.

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
│   ├── neural.ts             # AI model manager (Transformers.js)
│   ├── searchContext.ts      # Search session management
│   ├── session.ts            # Cookie session management
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
