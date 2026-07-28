import type { SearchResult } from './types.js'

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.search = ''
    u.pathname = u.pathname.replace(/\/+$/, '')
    return u.hostname + u.pathname
  } catch {
    return url.toLowerCase().trim()
  }
}

function stripTrackingParams(url: string): string {
  try {
    const u = new URL(url)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid',
      'ref', 'source', 'si', 's_kwcid', 'trk', 'mc_cid', 'mc_eid',
    ]
    for (const p of trackingParams) {
      u.searchParams.delete(p)
    }
    return u.toString()
  } catch {
    return url
  }
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordCount(s: string): number {
  const tokens = normalizeText(s).split(/\s+/)
  return tokens.filter(t => t.length > 0).length
}

function similarity(a: string, b: string): number {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (normA === normB) return 1
  if (normA.length === 0 || normB.length === 0) return 0

  const wordsA = new Set(normA.split(/\s+/))
  const wordsB = new Set(normB.split(/\s+/))
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])
  return intersection.size / union.size
}

const MAX_RESULTS = 50

export function deduplicate(results: SearchResult[]): SearchResult[] {
  const deduped: SearchResult[] = []
  const seenUrlKeys = new Set<string>()

  for (const r of results) {
    const cleanUrl = stripTrackingParams(r.url)
    const urlKey = normalizeUrl(cleanUrl)

    if (seenUrlKeys.has(urlKey)) continue
    seenUrlKeys.add(urlKey)

    let isDuplicate = false
    for (const existing of deduped) {
      if (
        similarity(existing.description, r.description) > 0.6 ||
        similarity(existing.title, r.title) > 0.75
      ) {
        isDuplicate = true
        break
      }
    }
    if (isDuplicate) continue

    deduped.push({ ...r, url: cleanUrl })

    if (deduped.length >= MAX_RESULTS) break
  }

  return deduped
}
