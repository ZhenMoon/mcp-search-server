import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

interface CookieEntry {
  value: string
  expiresAt: number
}

const TTL = 30 * 60 * 1000
const DUMP_PATH = '.opencode/cookies.json'

const cookies = new Map<string, CookieEntry>()
let loaded = false

async function loadDump(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    if (!existsSync(DUMP_PATH)) return
    const raw = await readFile(DUMP_PATH, 'utf-8')
    const data = JSON.parse(raw) as Record<string, [string, number]>
    for (const [domain, [value, expiresAt]] of Object.entries(data)) {
      if (Date.now() < expiresAt) cookies.set(domain, { value, expiresAt })
    }
  } catch { }
}

async function dumpCookies(): Promise<void> {
  try {
    const obj: Record<string, [string, number]> = {}
    for (const [domain, entry] of cookies) {
      if (Date.now() < entry.expiresAt) obj[domain] = [entry.value, entry.expiresAt]
    }
    if (!existsSync('.opencode')) await mkdir('.opencode', { recursive: true })
    await writeFile(DUMP_PATH, JSON.stringify(obj))
  } catch { }
}

export function getCookie(domain: string): string | null {
  const entry = cookies.get(domain)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cookies.delete(domain)
    return null
  }
  return entry.value
}

export function setCookie(domain: string, value: string): void {
  cookies.set(domain, { value, expiresAt: Date.now() + TTL })
  dumpCookies()
}

export function clearCookies(domain?: string): void {
  if (domain) cookies.delete(domain)
  else cookies.clear()
  dumpCookies()
}

export async function warmUp(
  url: string,
  domain: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<void> {
  await loadDump()
  if (getCookie(domain)) return
  try {
    const res = await fetch(url, { headers, signal, redirect: 'manual' })
    const allCookies = res.headers.getSetCookie()
    if (allCookies.length > 0) {
      const pairs: string[] = []
      for (const raw of allCookies) {
        const pair = raw.split(';')[0]?.trim()
        if (pair && pair.includes('=')) pairs.push(pair)
      }
      if (pairs.length > 0) setCookie(domain, pairs.join('; '))
    }
  } catch { }
}
