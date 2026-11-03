import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const seen = []
page.on('request', (r) => {
  const u = r.url()
  if (/pdflib|pdfjs|ops-/.test(u)) seen.push(u.split('/').pop())
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const homeHeavy = seen.slice()

await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const indexHeavy = seen.filter((u) => !homeHeavy.includes(u))

await page.goto(BASE + '/tools/merge', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const mergePageHeavy = seen.filter((u) => !homeHeavy.includes(u) && !indexHeavy.includes(u))

await page.setInputFiles('input[type=file]', ['test/sample.pdf', 'test/sample2.pdf'])
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 30000 })
const afterRun = seen.filter((u) => !homeHeavy.includes(u) && !indexHeavy.includes(u) && !mergePageHeavy.includes(u))

console.log('home loaded:', homeHeavy.length ? homeHeavy.join(', ') : 'none (engine not downloaded)')
console.log('tools index loaded:', indexHeavy.length ? indexHeavy.join(', ') : 'none')
console.log('merge page before run:', mergePageHeavy.length ? mergePageHeavy.join(', ') : 'none')
console.log('loaded on run:', afterRun.length ? afterRun.join(', ') : 'none')
console.log(
  homeHeavy.length === 0 && indexHeavy.length === 0 && afterRun.length > 0 ? 'PASS lazy engine' : 'FAIL lazy engine'
)

await browser.close()
