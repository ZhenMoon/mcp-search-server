# MCP Search Server

[English](./README.en.md) | 中文

<div align="center">

多引擎聚合搜索 MCP 服务器 — **7 个搜索引擎**并行搜索、自动去重、无用过滤、关联性排序、网页正文提取。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

兼容 **Cursor** · **Claude Desktop** · **Continue.dev** · **Windsurf** · **Trae**

</div>

---

## 目录

- [功能特性](#功能特性)
- [搜索引擎](#搜索引擎)
- [快速开始](#快速开始)
- [客户端配置](#客户端配置)
- [环境变量](#环境变量)
- [MCP 工具](#mcp-工具)
- [项目结构](#项目结构)
- [使用示例](#使用示例)

---

## 功能特性

- **多引擎并行** — 同时调用多个搜索引擎；`Promise.allSettled` 确保单引擎失败不影响整体
- **自动去重** — URL 归一化 + 标题/摘要 Jaccard 相似度去重
- **关联性排序** — 按查询词在标题/摘要/URL 中的匹配度加权排序，零匹配结果自动过滤
- **无用过滤** — 剔除广告词、导航词、跟踪参数/域名、短摘要、错误页面
- **网页抓取** — 使用 Mozilla Readability 提取正文，自动删除重复段落、版权声明、尾部推荐内容
- **MCP 协议** — 标准 stdio 传输，开箱即用
- **可配置** — 通过环境变量自由组合引擎

---

## 搜索引擎

| 引擎 | 类型 | 说明 |
|------|------|------|
| `bing` | 通用 | 微软必应，中文搜索结果较好 |
| `sogou` | 通用 | 搜狗搜索 |
| `baidu` | 通用 | 百度搜索 |
| `duckduckgo` | 通用 | DuckDuckGo（国内网络可能被阻断） |
| `brave` | 通用 | Brave Search（国内网络可能被阻断） |
| `github` | 代码 | GitHub 仓库搜索 |
| `zhihu` | 内容 | 知乎（通过 Bing `site:` 搜索） |

默认启用：`bing` `sogou` `baidu` `github` `zhihu`

---

## 快速开始

```bash
git clone https://github.com/ZhenMoon/mcp-search-server.git
cd mcp-search-server
npm install
npm run build
```

---

## 客户端配置

在 MCP 客户端配置中添加以下条目（将 `<path>` 替换为你的实际路径）：

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

**配置文件位置：**

| 客户端 | 配置文件路径 |
|--------|-------------|
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop | `~/.claude/settings.json` |
| Continue.dev | `~/.continue/config.json` |
| Windsurf / Trae | 在 MCP 配置中添加相同 command/args |

---

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `SEARCH_ENGINES` | 启用指定引擎（逗号分隔） | `bing,baidu,github` |
| `SEARCH_DISABLED_ENGINES` | 禁用指定引擎 | `duckduckgo,brave` |

国内网络建议：
```bash
SEARCH_DISABLED_ENGINES=duckduckgo,brave node build/index.js
```

---

## MCP 工具

### `search` — 多引擎聚合搜索

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | `string` | **必填** | 搜索关键词 |
| `maxResults` | `number` | `10` | 最大返回结果数（1–50） |
| `engines` | `string[]` | 默认 5 引擎 | 搜索引擎列表 |
| `timeout` | `number` | `15000` | 搜索超时（毫秒） |

### `search_engines` — 列出可用搜索引擎

无参数。

### `fetch` — 抓取网页正文

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | `string` | **必填** | 网页 URL |
| `timeout` | `number` | `15000` | 抓取超时（毫秒） |
| `maxLength` | `number` | `8000` | 返回内容最大长度 |

---

## 项目结构

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
├── README.md                 # 中文文档
└── README.en.md              # English
```

---

## 使用示例

```text
搜索 + 抓取组合使用：
  search("Rust 语言 入门教程", maxResults: 5)
  fetch("https://rustwiki.org/zh-CN/book/")

指定引擎：
  search(engines: ["bing", "zhihu"], query: "Vue.js 教程")

环境变量：
  SEARCH_ENGINES=bing,baidu node build/index.js
```

---

## License

MIT
