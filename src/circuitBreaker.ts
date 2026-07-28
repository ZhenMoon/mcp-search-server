interface BreakerState {
  failures: number
  lastFailure: number
}

const state = new Map<string, BreakerState>()
const MAX_FAILURES = 5
const COOLDOWN_MS = 60 * 1000

export function isEngineAvailable(name: string): boolean {
  const s = state.get(name)
  if (!s) return true
  if (s.failures < MAX_FAILURES) return true
  if (Date.now() - s.lastFailure > COOLDOWN_MS) {
    s.failures = 0
    return true
  }
  return false
}

export function recordFailure(name: string): void {
  const s = state.get(name) || { failures: 0, lastFailure: 0 }
  s.failures++
  s.lastFailure = Date.now()
  state.set(name, s)
}

export function recordSuccess(name: string): void {
  const s = state.get(name)
  if (s) {
    s.failures = 0  // full reset on success
  }
}

export function getBreakerStatus(): string[] {
  const lines: string[] = []
  for (const [name, s] of state) {
    const remaining = s.failures >= MAX_FAILURES
      ? Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - s.lastFailure)) / 1000))
      : 0
    lines.push(`${name}: ${s.failures}/${MAX_FAILURES} 失败${remaining > 0 ? ` (冷却 ${remaining}s)` : ''}`)
  }
  return lines
}
