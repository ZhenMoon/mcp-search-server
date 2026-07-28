import type { Browser, Page } from 'puppeteer-core'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function findChrome(): string | undefined {
  try {
    const fs = require('fs') as typeof import('fs')
    return CHROME_PATHS.find(p => fs.existsSync(p))
  } catch {
    return undefined
  }
}

export function isBrowserEnabled(): boolean {
  if (process.env.HEADLESS_BROWSER !== 'true' && process.env.HEADLESS_BROWSER !== '1') return false
  return !!findChrome()
}

async function lazyPuppeteer(): Promise<typeof import('puppeteer-core')> {
  return import('puppeteer-core')
}

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  if (launching) return launching

  launching = (async () => {
    const exePath = process.env.CHROME_PATH || findChrome()
    if (!exePath) throw new Error(
      'Chrome/Edge not found. Set HEADLESS_BROWSER=true and optionally CHROME_PATH for custom path.'
    )

    const puppeteer = await lazyPuppeteer()
    const b = await puppeteer.launch({
      executablePath: exePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    })
    browser = b
    launching = null
    return b
  })()

  return launching
}

export async function getPage(): Promise<Page | null> {
  if (!isBrowserEnabled()) return null
  try {
    const b = await getBrowser()
    const page = await b.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })
    return page
  } catch {
    return null
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    try { await browser.close() } catch { }
    browser = null
  }
}

process.on('exit', () => shutdownBrowser())
process.on('SIGINT', () => { shutdownBrowser(); process.exit() })
process.on('SIGTERM', () => { shutdownBrowser(); process.exit() })
