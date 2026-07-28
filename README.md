# MCP Search Server

[English](./README.en.md) | 中文

多引擎聚合搜索 MCP 服务器，支持 7 个搜索引擎并行搜索、自动去重、无用信息过滤，以及网页正文提取。

---

## 功能特性 / Features

- **多引擎并行** / Multi-engine Parallel — 同时调用多个搜索引擎，`Promise.allSettled` 确保单引擎失败不影响整体
- **自动去重** / Deduplication — URL 归一化 + 标题/摘要 Jaccard 相似度去重
- **关联性排序** / Relevance Ranking — 按查询词在标题/摘要/URL 中的匹配度加权排序
- **无用过滤** / Spam Filter — 剔除广告、导航词、跟踪参数/域名、短摘要、错误页面
- **网页抓取** / Page Fetch — 使用 Mozilla Readability 提取正文，自动删除重复段落和版权声明
- **MCP 协议** / MCP Protocol — 标准 stdio 传输，兼容 Cursor / Claude Desktop / Continue.dev 等客户端
- **可配置** / Configurable — 通过环境变量选择启用的引擎

---

## 搜索引擎 / Search Engines

| 引擎 / Engine | 类型 / Type | 说明 / Notes |
|--------------|-------------|-------------|
| `bing` | 通用 | 微软必应，中文搜索结果较好 |
| `sogou` | 通用 | 搜狗搜索 |
| `baidu` | 通用 | 百度搜索 |
| `duckduckgo` | 通用 | DuckDuckGo（国内网络可能被阻断） |
| `brave` | 通用 | Brave Search（国内网络可能被阻断） |
| `github` | 代码 | GitHub 仓库搜索 |
| `zhihu` | 内容 | 知乎（通过 Bing `site:` 搜索） |

---

## 快速开始 / Quick Start

### 安装 / Install

```bash
git clone https://github.com/ZhenMoon/mcp-search-server.git
cd mcp-search-server
npm install
npm run build
```

### 配置 MCP 客户端 / Configure MCP Client

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "mcp-search": {
      "command": "node",
      "args": ["<绝对路径>/mcp-search-server/build/index.js"]
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
      "args": ["<绝对路径>/mcp-search-server/build/index.js"]
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
        "args": ["<绝对路径>/mcp-search-server/build/index.js"]
      }
    }
  }
}
```

**Windsurf / Trae / 其他 MCP 客户端** — 在 MCP 配置中添加相同的 command/args 即可。

---

## 环境变量 / Environment Variables

| 变量 / Variable | 说明 / Description | 示例 / Example |
|----------------|-------------------|----------------|
| `SEARCH_ENGINES` | 启用指定引擎（逗号分隔） | `bing,baidu,github` |
| `SEARCH_DISABLED_ENGINES` | 禁用指定引擎 | `duckduckgo,brave` |

默认启用 5 个引擎：`bing, sogou, baidu, github, zhihu`。

国内网络建议：`SEARCH_DISABLED_ENGINES=duckduckgo,brave`

---

## MCP 工具 / Available Tools

### `search`

多引擎聚合搜索。

| 参数 / Parameter | 类型 / Type | 默认 / Default | 说明 / Description |
|-----------------|-------------|---------------|-------------------|
| `query` | `string` | 必填 | 搜索关键词 |
| `maxResults` | `number` | `10` | 最大返回结果数（1–50） |
| `engines` | `string[]` | 见上方 | 搜索引擎列表 |
| `timeout` | `number` | `15000` | 搜索超时（毫秒） |

### `search_engines`

列出所有可用搜索引擎。

### `fetch`

抓取网页正文内容。

| 参数 / Parameter | 类型 / Type | 默认 / Default | 说明 / Description |
|-----------------|-------------|---------------|-------------------|
| `url` | `string` | 必填 | 网页 URL |
| `timeout` | `number` | `15000` | 抓取超时（毫秒） |
| `maxLength` | `number` | `8000` | 返回内容最大长度 |

---

## 项目结构 / Project Structure

```
mcp-search-server/
├── src/
│   ├── index.ts              # MCP 服务器入口
│   ├── types.ts              # 类型定义
│   ├── aggregator.ts         # 多引擎聚合 + 相关性评分
│   ├── dedup.ts              # 搜索结果去重
│   ├── dedupContent.ts       # 网页正文去重
│   ├── filter.ts             # 无用信息过滤
│   ├── fetcher.ts            # 网页抓取 (Readability)
│   └── engines/
│       ├── bing.ts           # 必应
│       ├── sogou.ts          # 搜狗
│       ├── baidu.ts          # 百度
│       ├── duckduckgo.ts     # DuckDuckGo
│       ├── brave.ts          # Brave Search
│       ├── github.ts         # GitHub
│       └── zhihu.ts          # 知乎
├── package.json
├── tsconfig.json
└── README.md
```

---

## 使用示例 / Usage Examples

```text
# 搜索 + 抓取组合使用
search("Rust 语言 入门教程", maxResults: 5)
  → 返回 5 条结果
fetch(url: "https://rustwiki.org/zh-CN/book/ch01-00-getting-started.html")
  → 抓取并返回正文内容

# 指定引擎
search(engines: ["bing", "zhihu"], query: "Vue.js 教程")
  → 仅使用必应和知乎

# 环境变量指定引擎
SEARCH_ENGINES=bing,baidu node build/index.js
```

---

## License

MIT
