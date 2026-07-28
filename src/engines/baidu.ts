import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

function headers(ua: string, referer?: string): Record<string, string> {
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    ...(referer ? { Referer: referer } : {}),
  }
}

async function fetchBaidu(query: string, pn: number, signal: AbortSignal | undefined, mobile: boolean): Promise<{ html: string; ok: boolean }> {
  const baseUrl = mobile ? 'https://m.baidu.com/s' : 'https://www.baidu.com/s'
  const url = new URL(baseUrl)
  url.searchParams.set(mobile ? 'word' : 'wd', query)
  url.searchParams.set('pn', pn.toString())
  url.searchParams.set('ie', 'utf-8')

  const res = await fetch(url.toString(), {
    headers: headers(mobile ? MOBILE_UA : USER_AGENT, 'https://www.baidu.com/'),
    signal,
  })
  const html = await res.text()
  return { html, ok: res.ok && html.length > 1000 }
}

function parseBaiduDesktop(html: string, maxResults: number, results: SearchResult[]): number {
  const $ = cheerio.load(html)
  const items = $('#content_left').children()
  let count = 0

  for (const el of items) {
    if (results.length >= maxResults) break
    const h3 = $(el).find('h3')
    const title = h3.text().trim()
    if (!title) continue
    const link = h3.find('a').first()
    const rawUrl = link.attr('href') || ''
    if (!rawUrl) continue
    if (title.includes('百度图片') || rawUrl.includes('image.baidu.com')) continue

    const realUrl = resolveBaiduUrl(rawUrl)
    let description = ''
    for (const sel of ['.c-abstract', '.c-color-text', '.c-span18', '.cos-row', '.content-right_8Zs40', '.cosc-card-content-border', '[class*="abstract"]', '.c-gap-top-small']) {
      const d = $(el).find(sel).first().text().trim().replace(/\s+/g, ' ')
      if (d.length > description.length) description = d
    }
    if (!description) description = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 200)

    results.push({ title, url: realUrl, description, engine: 'baidu' })
    count++
  }

  return count
}

function parseBaiduMobile(html: string, maxResults: number, results: SearchResult[]): number {
  const $ = cheerio.load(html)
  const items = $('.result, .result-item, [data-log]')
  let count = 0

  for (const el of items) {
    if (results.length >= maxResults) break
    const link = $(el).find('a').first()
    const title = link.text().trim()
    const rawUrl = link.attr('href') || ''
    if (!title || !rawUrl) continue
    if (title.includes('百度图片')) continue

    let description = ''
    for (const sel of ['.c-abstract', '.c-line-clamp', '.summary', '.c-span-last']) {
      const d = $(el).find(sel).first().text().trim().replace(/\s+/g, ' ')
      if (d.length > description.length) description = d
    }

    results.push({ title, url: resolveBaiduUrl(rawUrl), description, engine: 'baidu' })
    count++
  }

  return count
}

export class BaiduEngine implements SearchEngine {
  readonly name = 'baidu'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let pn = 0

    for (let attempt = 0; attempt < 2; attempt++) {
      if (results.length >= maxResults) break
      const mobile = attempt === 1
      pn = 0

      try {
        while (results.length < maxResults) {
          const { html, ok } = await fetchBaidu(query, pn, signal, mobile)
          if (!ok) break

          const count = mobile
            ? parseBaiduMobile(html, maxResults, results)
            : parseBaiduDesktop(html, maxResults, results)

          if (count === 0) break
          pn += 10
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
        if (attempt === 0 && results.length === 0) continue
        break
      }

      if (results.length > 0) break
    }

    return results.slice(0, maxResults)
  }
}

function resolveBaiduUrl(raw: string): string {
  if (!raw.startsWith('http://www.baidu.com/link?url=') && !raw.startsWith('https://www.baidu.com/link?')) return raw
  try {
    const u = new URL(raw)
    const target = u.searchParams.get('url')
    if (target && /^https?:\/\//i.test(target)) return target
  } catch { }
  return raw
}
