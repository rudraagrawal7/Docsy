import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
let ok = true
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) ok = false
}

// drop on home -> organize with the file already loaded
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.setInputFiles('.hero .dropzone input[type=file]', 'test/sample.pdf')
await page.waitForURL('**/tools/organize', { timeout: 10000 })
await page.waitForSelector('.page-card', { timeout: 30000 })
check('home drop routes to organize with file', (await page.locator('.page-card').count()) === 3)

// tray persists across client-side routes (not full reloads — by design)
await page.locator('.back-link').click()
await page.waitForURL('**/tools')
await page.waitForSelector('.tray-panel', { timeout: 10000 })
check('tray shows dropped file', (await page.textContent('.tray-panel-files')).includes('sample.pdf'))
check('tray offers suggestions', (await page.locator('.tray-next').count()) > 2)

// continue into merge with the tray file
await page.locator('.tray-next', { hasText: 'Merge' }).first().click()
await page.waitForURL('**/tools/merge')
await page.waitForTimeout(300)
check('merge prefilled from tray', (await page.locator('.file-row').count()) === 1)
await page.setInputFiles('input[type=file]', 'test/sample2.pdf')
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 20000 })
check('merge result', (await page.textContent('.result')).includes('Done, locally'))

// send result to tray
await page.getByRole('button', { name: 'Send to tray' }).click()
await page.waitForURL('**/tools')
await page.waitForTimeout(400)
check('result sent to tray', (await page.textContent('.tray-panel-files')).includes('docsy-merged.pdf'))

// ZIP download from pdf-to-images (client-side nav keeps the tray alive)
await page.locator('.tray-next', { hasText: 'PDF to JPG' }).first().click().catch(async () => {
  await page.goto(BASE + '/tools/pdf-to-images')
})
await page.waitForTimeout(400)
if (!page.url().includes('pdf-to-images')) await page.goto(BASE + '/tools/pdf-to-images')
await page.setInputFiles('input[type=file]', 'test/sample.pdf')
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 30000 })
const dl = page.waitForEvent('download')
await page.getByRole('button', { name: /Download all/ }).click()
const d = await dl
await d.saveAs('test/out-pages.zip')
check('zip download', d.suggestedFilename().endsWith('.zip'), d.suggestedFilename())

// offline
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(async () => {
  await navigator.serviceWorker.ready
})
await page.waitForTimeout(1200)
await page.reload({ waitUntil: 'networkidle' })
await ctx.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
check('offline reload works', (await page.locator('h1').first().textContent()).includes('Your PDFs'))
await ctx.setOffline(false)

check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '))
await browser.close()
process.exit(ok ? 0 : 1)
