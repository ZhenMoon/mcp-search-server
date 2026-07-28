import type { Browser, Page } from 'puppeteer-core'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

const USER_DATA_DIR = '.chrome-profile'

function findChrome(): string | undefined {
  try {
    const fs = require('fs') as typeof import('fs')
    return CHROME_PATHS.find(p => fs.existsSync(p))
  } catch {
    return undefined
  }
}

export function isBrowserEnabled(): boolean {
  return process.env.HEADLESS_BROWSER === 'true' || process.env.HEADLESS_BROWSER === '1'
    || !!process.env.CHROME_DEBUG_URL
}

export function hasExistingBrowser(): boolean {
  return !!process.env.CHROME_DEBUG_URL
}

async function lazyPuppeteer(): Promise<typeof import('puppeteer-core')> {
  return import('puppeteer-core')
}

function findUserDataDir(): string | undefined {
  const LOCAL_APP_DATA = process.env.LOCALAPPDATA || ''
  const profiles = [
    `${LOCAL_APP_DATA}\\Google\\Chrome\\User Data\\Default`,
    `${LOCAL_APP_DATA}\\Microsoft\\Edge\\User Data\\Default`,
  ]
  try {
    const fs = require('fs') as typeof import('fs')
    return profiles.find(p => fs.existsSync(p))
  } catch {
    return undefined
  }
}

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  if (launching) return launching

  launching = (async () => {
    const puppeteer = await lazyPuppeteer()

    // Option 1: connect to existing Chrome via debug URL
    const debugUrl = process.env.CHROME_DEBUG_URL
    if (debugUrl) {
      try {
        const b = await puppeteer.connect({ browserURL: debugUrl })
        browser = b
        launching = null
        return b
      } catch {
        // fall through to launch
      }
    }

    // Option 2: launch Chrome with persistent profile
    const exePath = process.env.CHROME_PATH || findChrome()
    if (!exePath) throw new Error('Chrome/Edge not found. Set HEADLESS_BROWSER=true or CHROME_PATH.')

    const b = await puppeteer.launch({
      executablePath: exePath,
      headless: true,
      userDataDir: USER_DATA_DIR,
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
