import type { SearchResult, SearchEngine, SearchOptions } from './types.js'
import { DuckDuckGoEngine } from './engines/duckduckgo.js'
import { BingEngine } from './engines/bing.js'
import { SogouEngine } from './engines/sogou.js'
import { BaiduEngine } from './engines/baidu.js'
import { BraveEngine } from './engines/brave.js'
import { GitHubEngine } from './engines/github.js'
import { ZhihuEngine } from './engines/zhihu.js'
import { deduplicate } from './dedup.js'
import { trimResults, isFreshnessQuery, isStaticPage } from './filter.js'
import { adaptQuery, getQueryInfo } from './queryAdapter.js'
import { getCached, setCache } from './cache.js'
import { isEngineAvailable, recordFailure, recordSuccess } from './circuitBreaker.js'
import { expandQuery } from './queryExpander.js'

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

function termMatches(text: string, term: string): boolean {
  return text.toLowerCase().includes(term)
}

function scoreRelevance(query: string, result: SearchResult, preferFresh = false): number {
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

  let score = titleScore * 0.55 + descScore * 0.3 + urlScore * 0.15

  // freshness: deprioritize static pages for news queries
  if (preferFresh && isStaticPage(result.url)) {
    score *= 0.3
  }

  return score
}

function deduplicateAcrossEngines(results: SearchResult[], maxResults: number): SearchResult[] {
  const seen = new Map<string, SearchResult[]>()
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
  const engineCount = new Map<string, number>()

  for (const key of order) {
    if (out.length >= maxResults) break
    const group = seen.get(key)!
    // prefer result with longer description
    group.sort((a, b) => b.description.length - a.description.length)
    const chosen = group[0]
    out.push(chosen)
    engineCount.set(chosen.engine, (engineCount.get(chosen.engine) || 0) + 1)
  }

  return out
}

function diversifyResults(results: SearchResult[], maxResults: number): SearchResult[] {
  if (results.length <= maxResults) return results

  const engineGroups = new Map<string, SearchResult[]>()
  for (const r of results) {
    const list = engineGroups.get(r.engine) || []
    list.push(r)
    engineGroups.set(r.engine, list)
  }

  const engines = [...engineGroups.keys()]
  const totalEngines = engines.length
  const minPerEngine = Math.max(1, Math.floor(maxResults / totalEngines))

  const out: SearchResult[] = []
  const used = new Set<string>()

  // round-robin: take minPerEngine from each engine
  for (let round = 0; round < minPerEngine; round++) {
    for (const e of engines) {
      const group = engineGroups.get(e)!
      if (out.length >= maxResults) break
      const r = group[round]
      if (r && !used.has(r.url)) {
        out.push(r)
        used.add(r.url)
      }
    }
    if (out.length >= maxResults) break
  }

  // fill remaining slots with best scored
  if (out.length < maxResults) {
    for (const r of results) {
      if (out.length >= maxResults) break
      if (!used.has(r.url)) {
        out.push(r)
        used.add(r.url)
      }
    }
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

  // cache check
  const cached = await getCached(query, engineNames as string[], false)
  if (cached) {
    return {
      results: cached.results.slice(0, maxResults),
      reports: cached.reports as EngineReport[],
    }
  }

  const selectedEngines = engineNames
    .filter(name => name in ENGINES)
    .filter(name => isEngineAvailable(name))
    .map(name => ({ name, engine: ENGINES[name] }))

  if (selectedEngines.length === 0) return { results: [], reports: [] }

  const perEngine = Math.max(MIN_PER_ENGINE, Math.ceil(maxResults * 2.5 / selectedEngines.length))

  const enginesWithSignal = selectedEngines.map(({ name, engine }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, timeout)
    return { name, engine, controller, timer, signal: controller.signal }
  })

  const settled = await Promise.allSettled(
    enginesWithSignal.map(({ name, engine, signal, timer }) => {
      const adaptedQuery = adaptQuery(query, name)
      return engine.search(adaptedQuery, perEngine, signal).finally(() => {
        clearTimeout(timer)
      })
    })
  )

  const reports: EngineReport[] = []
  const all: SearchResult[] = []

  for (let i = 0; i < selectedEngines.length; i++) {
    const { name } = selectedEngines[i]
    const result = settled[i]

    if (result.status === 'fulfilled') {
      const items = result.value
      if (items.length === 0) {
        reports.push({ engine: name, status: 'empty', count: 0 })
      } else {
        reports.push({ engine: name, status: 'ok', count: items.length })
        all.push(...items)
        recordSuccess(name)
      }
    } else {
      const reason = result.reason
      reports.push({
        engine: name,
        status: 'error',
        count: 0,
        error: reason instanceof Error ? reason.message : String(reason),
      })
      recordFailure(name)
    }
  }

  for (const { timer } of enginesWithSignal) {
    clearTimeout(timer)
  }

  // query expansion fallback: if too few results, try expanded queries
  let results = all
  if (all.length < maxResults * 2 && all.length > 0) {
    const expanded = expandQuery(query)
    if (expanded.length > 1) {
      for (const eq of expanded.slice(1)) {
        if (results.length >= maxResults * 3) break
        const adapted = adaptQuery(eq, selectedEngines[0]?.name || 'bing')
        const fallbackEngine = ENGINES[selectedEngines[0]?.name || 'bing']
        if (fallbackEngine) {
          try {
            const extra = await fallbackEngine.search(adapted, perEngine)
            results.push(...extra)
          } catch { /* skip */ }
        }
      }
    }
  }

  const trimmed = trimResults(results)

  const preferFresh = isFreshnessQuery(query)

  const scored = trimmed
    .map(r => ({ result: r, score: scoreRelevance(query, r, preferFresh) }))
    .filter(x => x.score > 0)

  scored.sort((a, b) => b.score - a.score)

  let ranked = scored.map(x => x.result)

  // floor: always keep at least maxResults items even if relevance score is low
  if (ranked.length < maxResults && all.length > ranked.length) {
    const scoredSet = new Set(ranked.map(r => r.url))
    const extras = all.filter(r => !scoredSet.has(r.url)).slice(0, maxResults - ranked.length)
    ranked.push(...extras)
  }

  if (ranked.length === 0 && all.length > 0) {
    const coreTerms = query.replace(/[^\w\u4e00-\u9fff\s]/g, ' ').split(/\s+/).filter(t => t.length > 1)
    if (coreTerms.length > 1) {
      const simplified = coreTerms.slice(0, 2).join(' ')
      const fallbackScored = trimmed
        .map(r => ({ result: r, score: scoreRelevance(simplified, r, preferFresh) }))
        .filter(x => x.score > 0)
      fallbackScored.sort((a, b) => b.score - a.score)
      ranked = fallbackScored.map(x => x.result)
    }
    if (ranked.length === 0 && all.length > 0) {
      ranked = all.slice(0, maxResults)
    }
  }

  let deduped = deduplicateAcrossEngines(ranked, maxResults)

  deduped = diversifyResults(deduped, maxResults)

  const final = deduped.slice(0, maxResults)

  // write cache
  setCache(query, engineNames as string[], false, { results: final, reports })

  return { results: final, reports }
}


