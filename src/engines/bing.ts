import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const BING_URL = 'https://www.bing.com/search'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

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
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
          signal,
        })

        const html = await res.text()
        if (isBotBlocked(html)) break

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
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
    }

    return results.slice(0, maxResults)
  }
}

function isBotBlocked(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes('captcha') || lower.includes('verify you are human') || lower.includes('blocked')
}
