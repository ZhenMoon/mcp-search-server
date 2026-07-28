import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const ALT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface SogouConfig {
  baseUrl: string
  queryParam: string
  ua: string
  label: string
}

const CONFIGS: SogouConfig[] = [
  { baseUrl: 'https://www.sogou.com/web', queryParam: 'query', ua: USER_AGENT, label: 'desktop' },
  { baseUrl: 'https://www.sogou.com/sogou', queryParam: 'query', ua: ALT_UA, label: 'alt' },
  { baseUrl: 'https://www.sogou.com/web', queryParam: 'keyword', ua: USER_AGENT, label: 'keyword' },
]

async function fetchSogou(query: string, page: number, signal: AbortSignal | undefined, cfg: SogouConfig): Promise<string | null> {
  const url = new URL(cfg.baseUrl)
  url.searchParams.set(cfg.queryParam, query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('ie', 'utf8')

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': cfg.ua,
        Accept: 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: 'https://www.sogou.com/',
      },
      signal,
    })
    const html = await res.text()
    if (isChallenge(html)) return null
    return html
  } catch {
    return null
  }
}

function parseSogou(html: string, maxResults: number, results: SearchResult[], engineName: string): number {
  const $ = cheerio.load(html)
  const items = $('.vrwrap, .rb, .result')
  let count = 0

  for (const el of items) {
    if (results.length >= maxResults) break
    const titleLink = $(el).find('h3 a, h2 a, .vr-title a').first()
    const rawUrl = titleLink.attr('href') || ''
    const title = titleLink.text().trim()
    if (!title || !rawUrl) continue

    const realUrl = resolveSogouUrl(rawUrl)
    if (!realUrl) continue

    const description = $(el).find('.str_info, .ft, .text-layout, .star-wiki').first().text().trim()

    results.push({ title, url: realUrl, description, engine: engineName })
    count++
  }

  return count
}

export class SogouEngine implements SearchEngine {
  readonly name = 'sogou'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    for (const cfg of CONFIGS) {
      if (results.length >= maxResults) break
      let page = 1

      try {
        while (results.length < maxResults) {
          const html = await fetchSogou(query, page, signal, cfg)
          if (!html) break

          const count = parseSogou(html, maxResults, results, this.name)
          if (count === 0) break
          page++
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
      }

      if (results.length > 0) break
    }

    return results.slice(0, maxResults)
  }
}

function resolveSogouUrl(raw: string): string {
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
