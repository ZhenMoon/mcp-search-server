import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'
import { pickHeaders, isBlocked, delayMs, adaptiveDelay } from '../scraper.js'

const BING_URL = 'https://www.bing.com/search'

const BING_DOMAIN = 'bing.com'

export class BingEngine implements SearchEngine {
  readonly name = 'bing'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let page = 0

    try {
      while (results.length < maxResults) {
        const url = new URL(BING_URL)
        url.searchParams.set('q', query)
        url.searchParams.set('first', String(1 + page * 10))
        url.searchParams.set('setlang', 'zh-CN')

        const res = await fetch(url.toString(), {
          headers: pickHeaders(BING_DOMAIN),
          signal,
        })

        const html = await res.text()
        if (isBlocked(html)) break

        const $ = cheerio.load(html)
        const items = $('#b_results .b_algo')

        if (items.length === 0) break

        let pageCount = 0
        for (const el of items) {
          if (results.length >= maxResults) break
          const link = $(el).find('h2 a')
          const title = link.text().trim()
          const url = link.attr('href') || ''
          const description = $(el).find('.b_caption p').text().trim()

          if (title && url) {
            results.push({ title, url, description, engine: this.name })
            pageCount++
          }
        }

        if (pageCount === 0) break
        page++
        if (page < 3) await adaptiveDelay(BING_DOMAIN, 300, 1200)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
    }

    return results.slice(0, maxResults)
  }
}
