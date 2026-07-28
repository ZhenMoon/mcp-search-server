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
const MIN_PER_ENGINE = 10

function splitTerms(s: string): string[] {
  const cleaned = s.toLowerCase().replace(/[^\w\u4e00-\u9fff\s]/g, ' ').trim()
  if (!cleaned) return []
  return cleaned.split(/\s+/).filter(t => t.length > 0)
}

function termMatches(text: string, term: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes(term)
}

function scoreRelevance(query: string, result: SearchResult): number {
  const queryTerms = splitTerms(query)
  if (queryTerms.length === 0) return 0.5

  const title = result.title
  const desc = result.description
  const url = result.url

  let titleHits = 0
  let descHits = 0
  let urlHits = 0

  for (const qt of queryTerms) {
    if (termMatches(title, qt)) titleHits++
    if (termMatches(desc, qt)) descHits++
    if (termMatches(url, qt)) urlHits++
  }

  if (titleHits === 0 && descHits === 0 && urlHits === 0) return 0

  const titleScore = titleHits / queryTerms.length
  const descScore = descHits / queryTerms.length
  const urlScore = urlHits / queryTerms.length

  return titleScore * 0.55 + descScore * 0.3 + urlScore * 0.15
}

export async function aggregateSearch(options: SearchOptions): Promise<SearchResult[]> {
  const {
    query,
    maxResults = 10,
    engines: engineNames = ['bing', 'sogou', 'baidu', 'github', 'zhihu'],
    timeout = DEFAULT_TIMEOUT,
  } = options

  const selectedEngines = engineNames
    .filter(name => name in ENGINES)
    .map(name => ENGINES[name])

  if (selectedEngines.length === 0) return []

  const perEngine = Math.max(MIN_PER_ENGINE, Math.ceil(maxResults * 2 / selectedEngines.length))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const results = await Promise.allSettled(
      selectedEngines.map(engine =>
        engine.search(query, perEngine, controller.signal)
      )
    )

    const all: SearchResult[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        all.push(...r.value)
      }
    }

    const trimmed = trimResults(all)

    const scored = trimmed
      .map(r => ({ result: r, score: scoreRelevance(query, r) }))
      .filter(x => x.score > 0)

    scored.sort((a, b) => b.score - a.score)

    const ranked = scored.map(x => x.result)
    const deduped = deduplicate(ranked)

    return deduped.slice(0, maxResults)
  } finally {
    clearTimeout(timer)
  }
}
