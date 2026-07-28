import puppeteer, { type Browser, type Page } from 'puppeteer-core'

let browser: Browser | null = null

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function findChrome(): string | undefined {
  return CHROME_PATHS.find(p => {
    try { return require('fs').existsSync(p) } catch { return false }
  })
}

let launching: Promise<Browser> | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  if (launching) return launching

  launching = (async () => {
    const exePath = process.env.CHROME_PATH || findChrome()
    if (!exePath) throw new Error('Chrome/Edge not found. Set CHROME_PATH env var.')

    const b = await puppeteer.launch({
      executablePath: exePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1280,800',
      ],
    })
    browser = b
    launching = null
    return b
  })()

  return launching
}

export async function getPage(): Promise<Page> {
  const b = await getBrowser()
  const page = await b.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-CN,zh;q=0.9',
  })
  return page
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
