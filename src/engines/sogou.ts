import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export class SogouEngine implements SearchEngine {
  readonly name = 'sogou'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const configs = [
      { url: 'https://www.sogou.com/web', param: 'query' },
    ]

    for (const cfg of configs) {
      if (results.length >= maxResults) break
      let page = 1

      while (results.length < maxResults && page <= 2) {
        const url = new URL(cfg.url)
        url.searchParams.set(cfg.param, query)
        url.searchParams.set('page', String(page))
        url.searchParams.set('ie', 'utf8')

        try {
          const res = await fetch(url.toString(), {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-CN,zh;q=0.9' },
            signal,
          })
          const html = await res.text()
          if (isChallenge(html)) break

          const $ = cheerio.load(html)
          const items = $('.vrwrap, .rb, .result')
          let count = 0
          for (const el of items) {
            if (results.length >= maxResults) break
            const titleLink = $(el).find('h3 a, h2 a, .vr-title a').first()
            const rawUrl = titleLink.attr('href') || ''
            const title = titleLink.text().trim()
            if (!title || !rawUrl) continue
            const realUrl = resolveUrl(rawUrl)
            if (!realUrl) continue
            const description = $(el).find('.str_info, .ft, .text-layout, .star-wiki').first().text().trim()
            results.push({ title, url: realUrl, description, engine: 'sogou' })
            count++
          }
          if (count === 0) break
          page++
        } catch {
          break
        }
      }
      if (results.length > 0) break
    }

    return results.slice(0, maxResults)
  }
}

function resolveUrl(raw: string): string {
  try {
    const u = new URL(raw, 'https://www.sogou.com/web')
    const target = u.searchParams.get('url') || u.searchParams.get('u') || u.searchParams.get('link')
    if (target && /^https?:\/\//i.test(target)) return target
    if (u.protocol.startsWith('http')) return u.toString()
  } catch { }
  return ''
}

function isChallenge(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes('antispider') || lower.includes('请输入验证码') || lower.includes('访问过于频繁')
}
