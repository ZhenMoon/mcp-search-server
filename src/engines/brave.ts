import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const BRAVE_URL = 'https://search.brave.com/search'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export class BraveEngine implements SearchEngine {
  readonly name = 'brave'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let offset = 0

    try {
      while (results.length < maxResults) {
        const url = new URL(BRAVE_URL)
        url.searchParams.set('q', query)
        url.searchParams.set('source', 'web')
        url.searchParams.set('offset', String(offset))

        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
          signal,
        })

        const html = await res.text()
        const $ = cheerio.load(html)
        const items = $('#results .snippet')

        if (items.length === 0) break

        let pageCount = 0
        for (const el of items) {
          if (results.length >= maxResults) break
          const content = $(el).find('.result-content').first()
          if (content.length === 0) continue

          const mainLink = content.find('> a').first()
          const rawUrl = mainLink.attr('href') || ''
          const title = mainLink.find('.search-snippet-title').text().trim()
          const description = content.find('.generic-snippet').text().trim()

          if (title && rawUrl) {
            results.push({ title, url: rawUrl, description, engine: this.name })
            pageCount++
          }
        }

        if (pageCount === 0) break
        offset += pageCount
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') return results.slice(0, maxResults)
      throw err
    }

    return results.slice(0, maxResults)
  }
}
