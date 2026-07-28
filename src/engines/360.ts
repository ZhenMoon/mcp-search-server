import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'
import { pickHeaders, isBlocked } from '../scraper.js'

export class So360Engine implements SearchEngine {
  readonly name = '360'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let page = 1

    try {
      while (results.length < maxResults && page <= 5) {
        const url = new URL('https://www.so.com/s')
        url.searchParams.set('q', query)
        url.searchParams.set('ie', 'utf-8')
        if (page > 1) url.searchParams.set('pn', String(page))

        const res = await fetch(url.toString(), {
          headers: {
            ...pickHeaders(),
            Referer: 'https://www.so.com/',
          },
          signal,
        })

        const html = await res.text()
        if (isBlocked(html)) break

        const $ = cheerio.load(html)
        const items = $('.res-list')
        if (items.length === 0) break

        let count = 0
        for (const el of items) {
          if (results.length >= maxResults) break
          const titleEl = $(el).find('h3 a').first()
          const title = titleEl.text().trim()
          const rawUrl = titleEl.attr('href') || ''
          if (!title || !rawUrl) continue
          const url = resolveUrl(rawUrl)
          if (!url) continue
          const description = $(el).find('.res-desc').first().text().trim()
            || $(el).find('.res-rich').first().text().trim()
          results.push({ title, url, description, engine: this.name })
          count++
        }
        if (count === 0) break
        page++
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') return results.slice(0, maxResults)
      throw err
    }

    return results.slice(0, maxResults)
  }
}

function resolveUrl(raw: string): string {
  if (raw.startsWith('http')) return raw
  if (raw.startsWith('//')) return 'https:' + raw
  if (raw.startsWith('/link?m=') || raw.startsWith('link?m=')) {
    return 'https://www.so.com' + (raw.startsWith('/') ? '' : '/') + raw
  }
  return ''
}
