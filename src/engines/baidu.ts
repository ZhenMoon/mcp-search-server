import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const BAIDU_URL = 'https://www.baidu.com/s'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export class BaiduEngine implements SearchEngine {
  readonly name = 'baidu'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let pn = 0

    try {
      while (results.length < maxResults) {
        const url = new URL(BAIDU_URL)
        url.searchParams.set('wd', query)
        url.searchParams.set('pn', pn.toString())
        url.searchParams.set('ie', 'utf-8')

        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
          signal,
        })

        const html = await res.text()
        const $ = cheerio.load(html)
        const items = $('#content_left').children()

        if (items.length === 0) break

        let pageCount = 0
        for (const el of items) {
          if (results.length >= maxResults) break

          const h3 = $(el).find('h3')
          const title = h3.text().trim()
          if (!title) continue

          const link = h3.find('a').first()
          const rawUrl = link.attr('href') || ''
          if (!rawUrl) continue

          const realUrl = resolveBaiduUrl(rawUrl)

          let description = ''
          const descCandidates = [
            $(el).find('.c-abstract').first().text().trim(),
            $(el).find('.c-color-text').first().attr('aria-label') || '',
            $(el).find('.c-span18').first().text().trim(),
            $(el).find('.cos-row').first().text().trim(),
            $(el).find('.content-right_8Zs40').first().text().trim(),
            $(el).find('.cosc-card-content-border').first().text().trim(),
            $(el).find('[class*="abstract"]').first().text().trim(),
            $(el).find('.c-gap-top-small').first().text().trim(),
          ]
          for (const d of descCandidates) {
            const cleaned = d.replace(/\s+/g, ' ').trim()
            if (cleaned.length > description.length) description = cleaned
          }
          if (!description) {
            description = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 200)
          }

          results.push({ title, url: realUrl, description, engine: this.name })
          pageCount++
        }

        if (pageCount === 0) break
        pn += 10
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') return results.slice(0, maxResults)
      throw err
    }

    return results.slice(0, maxResults)
  }
}

function resolveBaiduUrl(raw: string): string {
  if (!raw.startsWith('http://www.baidu.com/link?url=')) return raw
  try {
    const u = new URL(raw)
    const target = u.searchParams.get('url')
    if (target && /^https?:\/\//i.test(target)) return target
  } catch { }
  return raw
}
