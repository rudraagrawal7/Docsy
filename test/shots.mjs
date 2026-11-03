import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'test/new-home.png' })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await mobile.goto(BASE, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(1200)
await mobile.screenshot({ path: 'test/new-home-mobile.png' })

await page.goto(BASE + '/tools/merge', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf', 'test/sample2.pdf'])
await page.waitForSelector('.preview-card', { timeout: 30000 })
await page.waitForTimeout(300)
await page.evaluate(() => {
  const el = document.querySelector('.preview-panel')
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160)
})
await page.waitForTimeout(400)
await page.screenshot({ path: 'test/new-merge-source.png' })

await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 60000 })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const el = document.querySelector('.preview-panel')
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160)
})
await page.waitForTimeout(500)
await page.screenshot({ path: 'test/new-merge-result.png' })

await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
await page.waitForTimeout(1100)
await page.screenshot({ path: 'test/new-tools.png' })

await browser.close()
console.log('done')
