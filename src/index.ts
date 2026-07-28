#!/usr/bin/env node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { aggregateSearch } from './aggregator.js'
import { fetchPage } from './fetcher.js'

const ALL_ENGINES = ['duckduckgo', 'bing', 'sogou', 'baidu', 'brave', 'github', 'zhihu'] as const

type Engine = typeof ALL_ENGINES[number]

function defaultEngines(): Engine[] {
  const env = process.env.SEARCH_ENGINES
  if (env) {
    const parsed = env.split(',').map(s => s.trim()).filter((s): s is Engine =>
      ALL_ENGINES.includes(s as any)
    )
    if (parsed.length > 0) return parsed
  }
  const disabled = process.env.SEARCH_DISABLED_ENGINES
  if (disabled) {
    const set = new Set(disabled.split(',').map(s => s.trim()))
    return ALL_ENGINES.filter(e => !set.has(e))
  }
  return [...ALL_ENGINES]
}

const server = new McpServer({
  name: 'mcp-search-server',
  version: '1.0.0',
  description: '多引擎聚合搜索 MCP 服务器 - 支持 7 个引擎 (DuckDuckGo/Bing/Sogou/Baidu/Brave/GitHub/知乎)，自动去重并过滤无用信息',
})

server.tool(
  'search',
  {
    query: z.string().describe('搜索关键词'),
    maxResults: z.number().int().min(1).max(50).default(10).describe('最大返回结果数'),
    engines: z
      .array(z.enum(ALL_ENGINES))
      .default(defaultEngines())
      .describe('搜索引擎列表'),
    timeout: z.number().int().min(3000).max(60000).default(15000).describe('搜索超时(毫秒)'),
  },
  async ({ query, maxResults, engines, timeout }) => {
    const results = await aggregateSearch({ query, maxResults, engines, timeout })
    return {
      content: [
        {
          type: 'text',
          text: results.length === 0
            ? '未找到结果'
            : formatResults(results),
        },
      ],
    }
  },
)

server.tool(
  'search_engines',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: ALL_ENGINES.join('\n'),
        },
      ],
    }
  },
)

server.tool(
  'fetch',
  {
    url: z.string().url().describe('要抓取的网页 URL'),
    timeout: z.number().int().min(3000).max(60000).default(15000).describe('抓取超时(毫秒)'),
    maxLength: z.number().int().min(500).max(100000).default(8000).describe('返回内容最大长度'),
  },
  async ({ url, timeout, maxLength }) => {
    const result = await fetchPage(url, timeout)
    if (!result.content) {
      return { content: [{ type: 'text', text: '无法获取页面内容' }] }
    }
    const truncated = result.content.length > maxLength
      ? result.content.substring(0, maxLength) + `\n\n...（内容过长，截取前 ${maxLength} 字符）`
      : result.content
    return {
      content: [
        {
          type: 'text',
          text: `标题: ${result.title}\nURL: ${result.url}\n字数: ${result.length}\n\n${truncated}`,
        },
      ],
    }
  },
)

function formatResults(results: Array<{ title: string; url: string; description: string; engine: string }>): string {
  return results
    .map((r, i) => {
      const lines = [`${i + 1}. ${r.title}`]
      lines.push(`   URL: ${r.url}`)
      if (r.description) lines.push(`   摘要: ${r.description}`)
      lines.push(`   来源: ${r.engine}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
