import type { SearchResult, SearchEngine, SearchOptions } from './types.js'
import { DuckDuckGoEngine } from './engines/duckduckgo.js'
import { BingEngine } from './engines/bing.js'
import { SogouEngine } from './engines/sogou.js'
import { BaiduEngine } from './engines/baidu.js'
import { BraveEngine } from './engines/brave.js'
import { GitHubEngine } from './engines/github.js'
import { ZhihuEngine } from './engines/zhihu.js'
import { deduplicate } from './dedup.js'
import { trimResults } from './filter.js'
import { adaptQuery, getQueryInfo } from './queryAdapter.js'

const ENGINES: Record<string, SearchEngine> = {
  duckduckgo: new DuckDuckGoEngine(),
  bing: new BingEngine(),
  sogou: new SogouEngine(),
  baidu: new BaiduEngine(),
  brave: new BraveEngine(),
  github: new GitHubEngine(),
  zhihu: new ZhihuEngine(),
}

const DEFAULT_TIMEOUT = 15000
const MIN_PER_ENGINE = 15

export interface EngineReport {
  engine: string
  status: 'ok' | 'error' | 'empty' | 'skipped'
  count: number
  error?: string
}

export interface AggregateResult {
  results: SearchResult[]
  reports: EngineReport[]
}

function splitTerms(s: string): string[] {
  const cleaned = s.toLowerCase().replace(/[^\w\u4e00-\u9fff\s]/g, ' ').trim()
  if (!cleaned) return []
  return cleaned.split(/\s+/).filter(t => t.length > 0)
}

function termMatches(text: string, term: string): boolean {
  return text.toLowerCase().includes(term)
}

function scoreRelevance(query: string, result: SearchResult): number {
  const info = getQueryInfo(query)
  const allTerms = [...info.terms, ...info.phrases]
  if (allTerms.length === 0) return 0.5

  const title = result.title
  const desc = result.description
  const url = result.url

  let titleHits = 0
  let descHits = 0
  let urlHits = 0

  for (const qt of allTerms) {
    if (termMatches(title, qt)) titleHits++
    if (termMatches(desc, qt)) descHits++
    if (termMatches(url, qt)) urlHits++
  }

  if (titleHits === 0 && descHits === 0 && urlHits === 0) return 0

  const titleScore = titleHits / allTerms.length
  const descScore = descHits / allTerms.length
  const urlScore = urlHits / allTerms.length

  return titleScore * 0.55 + descScore * 0.3 + urlScore * 0.15
}

function deduplicateAcrossEngines(results: SearchResult[], maxResults: number): SearchResult[] {
  const seen = new Map<string, SearchResult[]>()  // url -> results from different engines
  const order: string[] = []

  for (const r of results) {
    const urlKey = r.url.split('?')[0].replace(/\/+$/, '').toLowerCase()
    const existing = seen.get(urlKey)
    if (existing) {
      existing.push(r)
    } else {
      seen.set(urlKey, [r])
      order.push(urlKey)
    }
  }

  const out: SearchResult[] = []
  for (const key of order) {
    if (out.length >= maxResults) break
    const group = seen.get(key)!
    // prefer result with longer description (more informative)
    group.sort((a, b) => b.description.length - a.description.length)
    out.push(group[0])
  }

  return out
}

export async function aggregateSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { results } = await aggregateWithReport(options)
  return results
}

export async function aggregateWithReport(options: SearchOptions): Promise<AggregateResult> {
  const {
    query,
    maxResults = 10,
    engines: engineNames = ['bing', 'sogou', 'baidu', 'github', 'zhihu'],
    timeout = DEFAULT_TIMEOUT,
  } = options

  const selectedEngines = engineNames
    .filter(name => name in ENGINES)
    .map(name => ENGINES[name])

  if (selectedEngines.length === 0) return { results: [], reports: [] }

  const perEngine = Math.max(MIN_PER_ENGINE, Math.ceil(maxResults * 2.5 / selectedEngines.length))

  const enginesWithSignal = selectedEngines.map(engine => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    return { engine, controller, timer }
  })

  const settled = await Promise.allSettled(
    enginesWithSignal.map(({ engine, controller }) => {
      const adaptedQuery = adaptQuery(query, engine.name)
      return engine.search(adaptedQuery, perEngine, controller.signal).finally(() => {
        clearTimeout(enginesWithSignal.find(e => e.engine === engine)?.timer)
      })
    })
  )

  for (const { timer } of enginesWithSignal) {
    clearTimeout(timer)
  }

  const reports: EngineReport[] = []
  const all: SearchResult[] = []

  for (let i = 0; i < selectedEngines.length; i++) {
    const engine = selectedEngines[i]
    const result = settled[i]

    if (result.status === 'fulfilled') {
      const items = result.value
      if (items.length === 0) {
        reports.push({ engine: engine.name, status: 'empty', count: 0 })
      } else {
        reports.push({ engine: engine.name, status: 'ok', count: items.length })
        all.push(...items)
      }
    } else {
      const reason = result.reason
      reports.push({
        engine: engine.name,
        status: 'error',
        count: 0,
        error: reason instanceof Error ? reason.message : String(reason),
      })
    }
  }

  const trimmed = trimResults(all)

  const scored = trimmed
    .map(r => ({ result: r, score: scoreRelevance(query, r) }))
    .filter(x => x.score > 0)

  scored.sort((a, b) => b.score - a.score)

  let ranked = scored.map(x => x.result)

  // Fallback: if relevance filtering removed everything, try with simplified query
  if (ranked.length === 0 && all.length > 0) {
    const coreTerms = query.replace(/[^\w\u4e00-\u9fff\s]/g, ' ').split(/\s+/).filter(t => t.length > 1)
    if (coreTerms.length > 1) {
      const simplified = coreTerms.slice(0, 2).join(' ')
      const fallbackScored = trimmed
        .map(r => ({ result: r, score: scoreRelevance(simplified, r) }))
        .filter(x => x.score > 0)
      fallbackScored.sort((a, b) => b.score - a.score)
      ranked = fallbackScored.map(x => x.result)
    }
    // Second fallback: include top results anyway with a warning marker
    if (ranked.length === 0 && all.length > 0) {
      ranked = all.slice(0, maxResults)
    }
  }

  const deduped = deduplicateAcrossEngines(ranked, maxResults)

  return { results: deduped.slice(0, maxResults), reports }
}
