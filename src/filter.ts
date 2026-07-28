import type { SearchResult } from './types.js'

const AD_KEYWORDS = [
  '广告', 'ad', 'sponsored', '推广', 'promoted',
  'recommended', '推荐',
]

const NAV_KEYWORDS = [
  '登录', '注册', 'sign in', 'sign up', 'login', 'register',
  '首页', 'home', '联系我们', 'contact us',
  '关于我们', 'about us', '隐私政策', 'privacy policy',
  '服务条款', 'terms of service', 'cookie',
]

const BAD_TITLE_PATTERNS = [
  /^\d{1,3}\s*(错误|error|warning|notice|page not found|404)/i,
  /^(just a moment|please wait|验证码|安全验证)/i,
  /^403|^404|^500|^502|^503/,
]

const TRACKING_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'facebook.com/tr', 'amazon-adsystem.com',
]

const SHORT_DESC_THRESHOLD = 15
const MAX_RESULTS_PER_ENGINE = 20

export function isLowQuality(result: SearchResult): boolean {
  const title = result.title.trim()
  const desc = result.description.trim()

  if (!title && !desc) return true

  if (title.length < 2) return true

  if (BAD_TITLE_PATTERNS.some(p => p.test(title))) return true

  if (TRACKING_DOMAINS.some(d => result.url.toLowerCase().includes(d))) return true

  try {
    const hostname = new URL(result.url).hostname.toLowerCase()
    if (TRACKING_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return true
  } catch {
    // invalid URL — filter it out
    return true
  }

  const descLower = desc.toLowerCase()
  const titleLower = title.toLowerCase()
  if (AD_KEYWORDS.some(k => titleLower.includes(k) || descLower.includes(k))) return true

  if (NAV_KEYWORDS.some(k => titleLower === k || descLower === k)) return true

  const descWordCount = desc.split(/[\s,，。、；:：]+/).filter(w => w.length > 0).length
  const hasChinese = /[\u4e00-\u9fff]/.test(desc)
  if (!hasChinese && descWordCount < SHORT_DESC_THRESHOLD) return true

  return false
}

export function trimResults(results: SearchResult[]): SearchResult[] {
  return results
    .filter(r => !isLowQuality(r))
    .slice(0, MAX_RESULTS_PER_ENGINE)
}
