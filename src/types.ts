export interface SearchResult {
  title: string
  url: string
  description: string
  engine: string
}

export interface SearchOptions {
  query: string
  maxResults?: number
  engines?: string[]
  timeout?: number
  useNeural?: boolean
}

export interface SearchEngine {
  readonly name: string
  search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]>
}
