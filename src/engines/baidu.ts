import * as cheerio from 'cheerio'
import type { SearchResult, SearchEngine } from '../types.js'

const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

// Simple cookie jar
let cookieJar = ''
let lastCookieRefresh = 0
const COOKIE_TTL = 5 * 60 * 1000 // 5 min

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const now = Date.now()
  return {
    'User-Agent': BASE_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="136", "Not?A_Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    Connection: 'keep-alive',
    ...(cookieJar ? { Cookie: cookieJar } : {}),
    ...extra,
  }
}

async function refreshCookies(signal?: AbortSignal): Promise<void> {
  const now = Date.now()
  if (cookieJar && now - lastCookieRefresh < COOKIE_TTL) return

  try {
    const res = await fetch('https://www.baidu.com/', {
      headers: buildHeaders({ Referer: 'https://www.baidu.com/' }),
      signal,
      redirect: 'manual',
    })
    const setCookie = res.headers.get('set-cookie') || ''
    if (setCookie) {
      const parsed: string[] = []
      const cookies = setCookie.split(/,(?=\s*[a-zA-Z])/)
      for (const c of cookies) {
        const pair = c.split(';')[0]?.trim()
        if (pair && !pair.includes('=')) continue
        if (pair) parsed.push(pair)
      }
      if (parsed.length > 0) {
        cookieJar = parsed.join('; ')
        lastCookieRefresh = now
      }
    }
  } catch {
    // cookie refresh failure is non-fatal
  }
}

function randomDelay(min = 200, max = 800): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(r => setTimeout(r, ms))
}

async function fetchBaiduSearch(query: string, pn: number, signal?: AbortSignal): Promise<string | null> {
  const url = new URL('https://www.baidu.com/s')
  url.searchParams.set('wd', query)
  url.searchParams.set('pn', pn.toString())
  url.searchParams.set('ie', 'utf-8')
  url.searchParams.set('f', '8')
  url.searchParams.set('rsv_bp', '1')
  url.searchParams.set('rsv_idx', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: buildHeaders({ Referer: 'https://www.baidu.com/' }),
      signal,
      redirect: 'manual',
    })

    let html = ''
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') || ''
      if (location) {
        const redirRes = await fetch(new URL(location, 'https://www.baidu.com').toString(), {
          headers: buildHeaders({ Referer: 'https://www.baidu.com/' }),
          signal,
        })
        html = await redirRes.text()
      }
    } else {
      html = await res.text()
    }

    if (!html || html.length < 500) return null
    if (isBaiduBlocked(html)) return null
    return html
  } catch {
    return null
  }
}

function isBaiduBlocked(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes('antispider') || lower.includes('请输入验证码') || lower.includes('访问频率')
    || html.includes('https://www.baidu.com/cache/setblock/')
}

function parseBaiduResults(html: string, maxResults: number, results: SearchResult[]): number {
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
    for (const sel of ['.c-abstract', '.c-color-text', '.c-span18', '.cos-row',
      '.content-right_8Zs40', '.cosc-card-content-border', '[class*="abstract"]',
      '.c-gap-top-small', '.cosc-card-content', '[class*="content-border"]']) {
      const d = $(el).find(sel).first().text().trim().replace(/\s+/g, ' ')
      if (d.length > description.length) description = d
    }
    if (!description) {
      description = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 200)
    }

    results.push({ title, url: realUrl, description, engine: 'baidu' })
    count++
  }

  return count
}

export class BaiduEngine implements SearchEngine {
  readonly name = 'baidu'

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    await refreshCookies(signal)

    if (cookieJar) {
      await randomDelay(300, 1000)
    }

    let pn = 0
    let consecutiveEmpty = 0

    try {
      while (results.length < maxResults) {
        const html = await fetchBaiduSearch(query, pn, signal)
        if (!html) {
          consecutiveEmpty++
          if (consecutiveEmpty >= 2) break
          // retry with fresh cookies
          cookieJar = ''
          lastCookieRefresh = 0
          await refreshCookies(signal)
          await randomDelay(500, 1500)
          continue
        }

        consecutiveEmpty = 0
        const count = parseBaiduResults(html, maxResults, results)
        if (count === 0) break
        pn += 10

        await randomDelay(100, 400)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
    }

    return results.slice(0, maxResults)
  }
}

function resolveBaiduUrl(raw: string): string {
  if (!raw.includes('baidu.com/link?')) return raw
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const target = u.searchParams.get('url')
    if (target && /^https?:\/\//i.test(target)) return target
    return u.toString()
  } catch {
    return raw
  }
}
