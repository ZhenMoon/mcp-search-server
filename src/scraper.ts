const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
]

const ACCEPT_LANGUAGES = [
  'zh-CN,zh;q=0.9,en;q=0.8',
  'zh-CN,zh;q=0.9',
  'en-US,en;q=0.9,zh-CN;q=0.8',
  'en;q=0.9,zh-CN;q=0.8',
  'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
]

const BLOCKED_PATTERNS = [
  /captcha/i,
  /verify\s*(you\s*are)?\s*human/i,
  /blocked/i,
  /antispider/i,
  /access\s*denied/i,
  /请输入验证码/,
  /验证码/,
  /访问过于频繁/,
  /just\s*a\s*moment/i,
  /challenge/i,
  /please\s*wait/i,
  /页面加载中/,
  /安全检查/,
  /security\s*check/i,
]

let uaIndex = 0
let langIndex = 0

export function pickHeaders(): Record<string, string> {
  uaIndex = (uaIndex + 1) % USER_AGENTS.length
  langIndex = (langIndex + 1) % ACCEPT_LANGUAGES.length

  return {
    'User-Agent': USER_AGENTS[uaIndex],
    'Accept-Language': ACCEPT_LANGUAGES[langIndex],
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
}

export function isBlocked(html: string): boolean {
  return BLOCKED_PATTERNS.some(p => p.test(html))
}

export function delayMs(min = 300, max = 1200): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
