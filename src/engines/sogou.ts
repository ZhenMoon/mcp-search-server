import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'
import { pickHeaders, isBlocked, adaptiveDelay } from '../scraper.js'

const DOMAIN = 'sogou.com'

export class SogouEngine implements SearchEngine {
  readonly name = 'sogou'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let page = 1

    while (results.length < maxResults && page <= 2) {
      const url = new URL('https://www.sogou.com/web')
      url.searchParams.set('query', query)
      url.searchParams.set('page', String(page))
      url.searchParams.set('ie', 'utf8')

      try {
        const res = await fetch(url.toString(), {
          headers: pickHeaders(DOMAIN),
          signal,
        })

        const html = await res.text()
        if (isBlocked(html)) break

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
        if (page < 3) await adaptiveDelay(DOMAIN, 1000, 2000)
      } catch {
        break
      }
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
