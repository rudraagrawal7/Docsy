import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
let ok = true
const check = (n, c, e = '') => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' — ' + e : ''}`)
  if (!c) ok = false
}

await page.goto(BASE + '/tools/merge', { waitUntil: 'networkidle' })
await page.getByRole('link', { name: 'Privacy', exact: true }).first().click()
await page.waitForTimeout(1200)
const hash = await page.evaluate(() => location.hash)
const near = await page.evaluate(() => {
  const el = document.querySelector('#privacy')
  return Math.abs(el.getBoundingClientRect().top - 70)
})
check('nav Privacy scrolls to section', hash === '#privacy' && near < 160, `${hash} · ${Math.round(near)}px off`)

await page.getByRole('link', { name: 'How it works', exact: true }).first().click()
await page.waitForTimeout(1200)
const nearHow = await page.evaluate(() => Math.abs(document.querySelector('#how').getBoundingClientRect().top - 70))
check('nav How it works scrolls', nearHow < 160, `${Math.round(nearHow)}px off`)

// tool search works
await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
await page.fill('.search-box input', 'redact')
await page.waitForTimeout(250)
const cards = await page.locator('.tool-card').count()
check('tool search filters', cards >= 1 && cards < 10, `${cards} results`)

// unknown tool → 404 page
await page.goto(BASE + '/tools/nope', { waitUntil: 'networkidle' })
check('unknown tool shows 404', (await page.textContent('h1')).includes('slipped out'))

check('no page errors', errs.length === 0, errs.join(' | '))
await browser.close()
process.exit(ok ? 0 : 1)
