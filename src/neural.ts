import { pipeline, env } from '@xenova/transformers'
import type { SearchResult } from './types.js'

env.allowLocalModels = false
env.useFSCache = true

const EMBEDDING_MODEL = 'Xenova/jina-embeddings-v2-base-zh'
const RERANKER_MODEL = 'Xenova/bge-reranker-v2-m3'
const SUMMARIZER_MODEL = 'Xenova/distilbart-cnn-6-6'

let embedPipeline: any = null
let rerankerPipeline: any = null
let summaryPipeline: any = null

let embedLoaded = false
let rerankerLoaded = false
let summaryLoaded = false

export function isEmbeddingLoaded(): boolean { return embedLoaded }
export function isRerankerLoaded(): boolean { return rerankerLoaded }
export function isSummarizerLoaded(): boolean { return summaryLoaded }

async function loadEmbedding(): Promise<void> {
  if (embedLoaded) return
  try {
    embedPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, { quantized: true })
    embedLoaded = true
  } catch (e) {
    console.error(`[neural] Embedding model "${EMBEDDING_MODEL}" load failed:`, e)
    throw e
  }
}

async function loadReranker(): Promise<void> {
  if (rerankerLoaded) return
  try {
    rerankerPipeline = await pipeline('text-classification', RERANKER_MODEL, { quantized: true })
    rerankerLoaded = true
  } catch (e) {
    console.error(`[neural] Reranker model "${RERANKER_MODEL}" load failed:`, e)
    throw e
  }
}

async function loadSummarizer(): Promise<void> {
  if (summaryLoaded) return
  try {
    summaryPipeline = await pipeline('summarization', SUMMARIZER_MODEL, { quantized: true })
    summaryLoaded = true
  } catch (e) {
    console.error(`[neural] Summarizer model "${SUMMARIZER_MODEL}" load failed:`, e)
    throw e
  }
}

export async function preloadAll(): Promise<void> {
  await Promise.allSettled([loadEmbedding(), loadReranker(), loadSummarizer()])
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  await loadEmbedding()
  const prefixed = texts.map(t => `text: ${t}`)
  const output = await embedPipeline(prefixed, { pooling: 'mean', normalize: true })
  return output.tolist()
}

export async function semanticDeduplicate(results: SearchResult[], threshold = 0.85): Promise<SearchResult[]> {
  if (results.length <= 1) return results
  try {
    await loadEmbedding()
    const texts = results.map(r => `${r.title} ${r.description}`)
    const embeddings = await embedTexts(texts)
    const keep = new Array(results.length).fill(true)
    for (let i = 0; i < embeddings.length; i++) {
      if (!keep[i]) continue
      for (let j = i + 1; j < embeddings.length; j++) {
        if (!keep[j]) continue
        const sim = cosineSimilarity(embeddings[i], embeddings[j])
        if (sim > threshold) {
          if (results[i].description.length >= results[j].description.length) {
            keep[j] = false
          } else {
            keep[i] = false
            break
          }
        }
      }
    }
    return results.filter((_, i) => keep[i])
  } catch (e) {
    console.error('[neural] semantic dedup failed:', e)
    return results
  }
}

export async function rerankResults(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length <= 1) return results
  try {
    await loadReranker()
    const pairs = results.map(r => `${query} [SEP] ${r.title} ${r.description}`)
    const scores = await rerankerPipeline(pairs)
    const scored = results.map((r, i) => ({ result: r, score: scores[i].score }))
    scored.sort((a, b) => b.score - a.score)
    return scored.map(x => x.result)
  } catch (e) {
    console.error('[neural] reranker failed:', e)
    return results
  }
}

export async function summarizeText(text: string, maxLength = 150, minLength = 40): Promise<string> {
  await loadSummarizer()
  const truncated = text.length > 3000 ? text.substring(0, 3000) : text
  const result = await summaryPipeline(truncated, { max_length: maxLength, min_length: minLength })
  return result[0].summary_text
}
