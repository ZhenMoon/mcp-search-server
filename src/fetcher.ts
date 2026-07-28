import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { deduplicateContent } from './dedupContent.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export interface FetchResult {
  url: string
  title: string
  content: string
  excerpt: string
  length: number
}

export async function fetchPage(url: string, timeout = 15000): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    const html = await res.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    let content: string

    if (!article) {
      const title = dom.window.document.title?.trim() || ''
      const body = dom.window.document.body
      if (body) {
        const clone = body.cloneNode(true) as HTMLElement
        const $scr = clone.querySelectorAll('script, style, nav, footer, header, aside, iframe, svg, form, noscript, [role="navigation"]')
        for (const el of $scr) el.remove()
        content = clone.textContent?.replace(/\s+/g, ' ').trim() || ''
      } else {
        content = ''
      }
    } else {
      content = article.textContent?.replace(/\s+/g, ' ').trim() || ''
    }

    const cleaned = deduplicateContent(content)

    return {
      url: res.url,
      title: article?.title || dom.window.document.title?.trim() || '',
      content: cleaned,
      excerpt: cleaned.substring(0, 200),
      length: cleaned.length,
    }
  } finally {
    clearTimeout(timer)
  }
}
