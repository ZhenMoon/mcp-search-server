/**
 * Shared session state across engine instances and searches.
 * Keeps cookies warm so engines don't need to re-authenticate every search.
 */

interface CookieEntry {
  value: string
  expiresAt: number
}

const TTL = 10 * 60 * 1000 // 10 minutes

const cookies = new Map<string, CookieEntry>()

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
}

export function clearCookies(domain?: string): void {
  if (domain) cookies.delete(domain)
  else cookies.clear()
}

/**
 * Extract cookies from a Set-Cookie header string.
 * Returns a semicolon-joined cookie string suitable for Cookie header.
 */
export function parseSetCookie(header: string): string {
  const pairs: string[] = []
  // split on comma only when followed by a known cookie name char
  const parts = header.split(/,(?=\s*[a-zA-Z])/)
  for (const part of parts) {
    const pair = part.split(';')[0]?.trim()
    if (pair && pair.includes('=')) pairs.push(pair)
  }
  return pairs.join('; ')
}

export async function warmUp(
  url: string,
  domain: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<void> {
  if (getCookie(domain)) return
  try {
    const res = await fetch(url, { headers, signal, redirect: 'manual' })
    const raw = res.headers.get('set-cookie')
    if (raw) {
      const parsed = parseSetCookie(raw)
      if (parsed) setCookie(domain, parsed)
    }
  } catch {
    // non-fatal
  }
}
