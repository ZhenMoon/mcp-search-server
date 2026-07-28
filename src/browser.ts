import type { Browser, Page } from 'puppeteer-core'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null
let chromeProcess: ChildProcess | null = null

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function findChrome(): string {
  const envPath = process.env.CHROME_PATH
  if (envPath && existsSync(envPath)) return envPath
  for (const p of CHROME_PATHS) if (existsSync(p)) return p
  return ''
}

function findUserProfile(): string | undefined {
  const appData = process.env.LOCALAPPDATA || ''
  for (const dir of [`${appData}\\Google\\Chrome\\User Data`, `${appData}\\Microsoft\\Edge\\User Data`]) {
    if (existsSync(dir)) return dir
  }
  return undefined
}

function fallbackProfile(): string {
  const dir = `${process.cwd()}\\.chrome-profile`
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function isBrowserEnabled(): boolean {
  return process.env.HEADLESS_BROWSER === 'true' || process.env.HEADLESS_BROWSER === '1'
}

async function lazyPuppeteer() {
  return import('puppeteer-core')
}

function tryConnect(port: number): Promise<Browser> {
  return lazyPuppeteer().then(p => p.connect({ browserURL: `http://127.0.0.1:${port}` }) as Promise<Browser>)
}

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  if (launching) return launching

  launching = (async () => {
    const exePath = findChrome()
    if (!exePath) throw new Error('Chrome/Edge not found.')

    // 1) Try connecting to any already-running Chrome with debug port
    for (const port of [9222, 9223, 9224]) {
      try { return await tryConnect(port) } catch { }
    }

    // 2) Launch Chrome ourselves
    const debugPort = 9222 + Math.floor(Math.random() * 100)
    const userProfile = findUserProfile()

    // Try real profile first (Chrome must NOT be running)
    if (userProfile) {
      chromeProcess = spawn(exePath, [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${userProfile}`,
        '--no-first-run', '--no-default-browser-check',
        '--window-size=1280,800',
      ], { stdio: 'ignore', detached: true })
      chromeProcess.unref()

      if (await waitForConnect(debugPort)) {
        const b = await tryConnect(debugPort)
        browser = b; launching = null; return b
      }
      killChrome()
    }

    // Fallback: fresh profile (works even when Chrome is running)
    chromeProcess = spawn(exePath, [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${fallbackProfile()}`,
      '--no-first-run', '--no-default-browser-check',
      '--window-size=1280,800',
    ], { stdio: 'ignore', detached: true })
    chromeProcess.unref()

    if (await waitForConnect(debugPort)) {
      const b = await tryConnect(debugPort)
      browser = b; launching = null; return b
    }

    throw new Error('Failed to start Chrome.')
  })()

  return launching
}

async function waitForConnect(port: number, tries = 20): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 500))
    try { await tryConnect(port); return true } catch { }
  }
  return false
}

function killChrome(): void {
  if (chromeProcess) {
    try { process.kill(-chromeProcess.pid!) } catch { }
    chromeProcess = null
  }
}

export async function getPage(): Promise<Page | null> {
  if (!isBrowserEnabled()) return null
  try {
    const b = await getBrowser()
    return b.newPage()
  } catch { return null }
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) { try { await browser.close() } catch { } browser = null }
  killChrome()
}

process.on('exit', () => shutdownBrowser())
process.on('SIGINT', () => { shutdownBrowser(); process.exit() })
process.on('SIGTERM', () => { shutdownBrowser(); process.exit() })
