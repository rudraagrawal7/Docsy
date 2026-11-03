import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = 'http://localhost:4173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

async function fieldByLabel(label) {
  return page.locator(`.field:has(label:text-is("${label}")) input`).first()
}

/* A. heavy image PDF → compress should genuinely shrink it */
await page.goto(BASE + '/tools/images-to-pdf', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/home-scrolled.png'])
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 60000 })
let dl = page.waitForEvent('download')
await page.click('.result-dl')
let d = await dl
await d.saveAs('test/heavy.pdf')
const heavySize = fs.statSync('test/heavy.pdf').size

await page.goto(BASE + '/tools/compress', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/heavy.pdf'])
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 90000 })
const compressNote = await page.textContent('.result-note')
check('compress reports a real saving', /Saved \d/.test(compressNote), compressNote.slice(0, 100))
dl = page.waitForEvent('download')
await page.click('.result-dl')
d = await dl
await d.saveAs('test/heavy-compressed.pdf')
const smallSize = fs.statSync('test/heavy-compressed.pdf').size
check('compressed file is smaller', smallSize < heavySize, `${heavySize} → ${smallSize} bytes`)

/* B. split into ranges → multiple files */
await page.goto(BASE + '/tools/split', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf'])
await page.locator('.field:has(label:text-is("Mode")) select').selectOption('ranges')
await (await fieldByLabel('Pages')).fill('1-2, 3')
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 30000 })
const rangeNote = await page.textContent('.result-note')
const rangeCount = await page.locator('.result-file').count()
check('split ranges yields 2 files', rangeCount === 2, `${rangeCount} files · ${rangeNote}`)
dl = page.waitForEvent('download')
await page.getByRole('button', { name: /Download all/ }).click()
d = await dl
await d.saveAs('test/out-ranges.zip')
check('split ranges zip download', d.suggestedFilename().endsWith('.zip'), d.suggestedFilename())

/* C. split every page */
await page.goto(BASE + '/tools/split', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf'])
await page.locator('.field:has(label:text-is("Mode")) select').selectOption('each')
await page.click('button.run-btn')
await page.waitForSelector('.result', { timeout: 30000 })
check('split each page yields 3 files', (await page.locator('.result-file').count()) === 3)

/* D. signed output actually contains the signature where it was placed */
await page.goto(BASE + '/tools/sign', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf'])
await page.waitForSelector('.sign-canvas img', { timeout: 30000 })
const pad = await page.locator('.sig-pad').boundingBox()
await page.mouse.move(pad.x + 40, pad.y + 90)
await page.mouse.down()
for (let i = 0; i < 26; i++) await page.mouse.move(pad.x + 40 + i * 8, pad.y + 90 + Math.sin(i / 2) * 20)
await page.mouse.up()
await page.getByRole('button', { name: 'Use signature' }).click()
await page.waitForSelector('.sign-stamp', { timeout: 10000 })
const box = await page.locator('.sign-canvas').boundingBox()
await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.7)
await page.getByRole('button', { name: 'Apply signature' }).click()
await page.waitForSelector('.result', { timeout: 30000 })
dl = page.waitForEvent('download')
await page.click('.result-dl')
d = await dl
await d.saveAs('test/out-signed.pdf')

await page.goto(BASE + '/tools/sign', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/out-signed.pdf'])
await page.waitForSelector('.sign-canvas img', { timeout: 30000 })
await page.waitForTimeout(500)
const density = await page.evaluate(async () => {
  const img = document.querySelector('.sign-canvas img')
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const dark = (x0, y0, w, h) => {
    const d = g.getImageData(x0, y0, w, h).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 110 && d[i + 1] < 110) n++
    return n / (w * h)
  }
  const W = c.width
  const H = c.height
  return {
    placed: dark(Math.round(W * 0.55), Math.round(H * 0.68), Math.round(W * 0.28), Math.round(H * 0.1)),
    blank: dark(Math.round(W * 0.1), Math.round(H * 0.72), Math.round(W * 0.25), Math.round(H * 0.1)),
  }
})
check(
  'signature renders where it was placed',
  density.placed > density.blank * 3 + 0.002,
  `placed ${(density.placed * 100).toFixed(1)}% dark vs blank ${(density.blank * 100).toFixed(1)}%`
)
await page.screenshot({ path: 'test/signed-verify.png', fullPage: true })

await browser.close()
process.exit(results.every(Boolean) ? 0 : 1)
