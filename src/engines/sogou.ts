import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const SOGOU_URL = 'https://www.sogou.com/web'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export class SogouEngine implements SearchEngine {
  readonly name = 'sogou'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let page = 1

    try {
      while (results.length < maxResults) {
        const url = new URL(SOGOU_URL)
        url.searchParams.set('query', query)
        url.searchParams.set('page', String(page))
        url.searchParams.set('ie', 'utf8')

        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            Referer: 'https://www.sogou.com/',
          },
          signal,
        })

        const html = await res.text()
        if (isChallenge(html)) break

        const $ = cheerio.load(html)
        const items = $('.vrwrap, .rb')

        if (items.length === 0) break

        let pageCount = 0
        for (const el of items) {
          if (results.length >= maxResults) break
          const titleLink = $(el).find('h3 a, h2 a').first()
          const rawUrl = titleLink.attr('href') || ''
          const title = titleLink.text().trim()
          const realUrl = resolveSogouUrl(rawUrl)
          const description = $(el).find('.str_info, .ft, .text-layout').first().text().trim()

          if (title && realUrl) {
            results.push({ title, url: realUrl, description, engine: this.name })
            pageCount++
          }
        }

        if (pageCount === 0) break
        page++
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
    }

    return results.slice(0, maxResults)
  }
}

function resolveSogouUrl(raw: string): string {
  try {
    const u = new URL(raw, SOGOU_URL)
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
