import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = 'http://localhost:4173'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const results = []
const errors = []
const external = []

function log(step, ok, extra = '') {
  results.push({ step, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${extra ? '  — ' + extra : ''}`)
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  deviceScaleFactor: 1,
})
const page = await context.newPage()

page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`)
})
page.on('request', (r) => {
  try {
    const u = new URL(r.url())
    if (u.origin !== BASE) external.push(r.url())
  } catch {}
})

async function shot(name) {
  await page.screenshot({ path: `test/${name}.png`, fullPage: true })
}
async function runTool(id, files, opts = {}) {
  await page.goto(`${BASE}/tools/${id}`, { waitUntil: 'networkidle' })
  if (files) await page.setInputFiles('input[type=file]', files)
  await page.waitForTimeout(200)
  if (opts.text !== undefined) await page.fill('textarea', opts.text)
  if (opts.select) {
    for (const [label, value] of Object.entries(opts.select)) {
      const sel = page.locator(`select`).filter({ has: page.locator(`option[value="${value}"]`) }).first()
      await sel.selectOption(value)
    }
  }
  if (opts.fill) {
    for (const [label, value] of Object.entries(opts.fill)) {
      const input = page.locator(`.field:has(label:text-is("${label}")) input`).first()
      await input.fill(String(value))
    }
  }
  await page.click('button.run-btn')
  await page.waitForSelector('.result', { timeout: 30000 })
  return (await page.textContent('.result-note')) || ''
}
async function downloadFirst(name) {
  const dl = page.waitForEvent('download', { timeout: 20000 })
  await page.click('.result-dl')
  const d = await dl
  await d.saveAs(`test/out-${name}`)
  return d.suggestedFilename()
}

// 1. home
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
log('home renders hero', (await page.locator('h1').first().textContent()).includes('Your PDFs'))
log('home has tool grid', (await page.locator('.tool-card').count()) > 20, `${await page.locator('.tool-card').count()} cards`)
await shot('home')

// 2. tools index
await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
log('tools index renders', (await page.locator('.tool-card').count()) > 20)
await shot('tools')

// 3. merge
let note = await runTool('merge', ['test/sample.pdf', 'test/sample2.pdf'])
log('merge runs', note.includes('files combined'), note.slice(0, 80))
log('merge download name', (await downloadFirst('merged.pdf')).endsWith('.pdf'))

// 4. split (extract)
note = await runTool('split', ['test/sample.pdf'])
log('split extracts', note.toLowerCase().includes('page') || note.includes('extracted'), note.slice(0, 80))

// 5. compress
note = await runTool('compress', ['test/sample.pdf'])
log('compress runs', note.length > 10, note.slice(0, 90))
await shot('compress')

// 6. rotate
note = await runTool('rotate', ['test/sample.pdf'])
log('rotate runs', note.includes('rotated'), note.slice(0, 80))

// 7. watermark
note = await runTool('watermark', ['test/sample.pdf'])
log('watermark runs', note.includes('Watermark'), note.slice(0, 80))

// 8. page numbers
note = await runTool('page-numbers', ['test/sample.pdf'])
log('page numbers run', note.includes('searchable') || note.includes('text'), note.slice(0, 80))

// 9. inspect
note = await runTool('inspect', ['test/sample.pdf'])
const info = await page.textContent('.info-grid')
log('inspect reads pages', info.includes('3') && info.includes('searchable'), note.slice(0, 80))
await shot('inspect')

// 10. pdf to text
note = await runTool('pdf-to-text', ['test/sample.pdf'])
log('pdf to text runs', note.includes('characters'), note.slice(0, 80))

// 11. text to pdf
note = await runTool('text-to-pdf', null, { text: 'Hello from Docsy.\n\nThis is a test of the typesetting engine. '.repeat(20) })
log('text to pdf runs', note.includes('typeset') || note.includes('page'), note.slice(0, 80))

// 12. pdf to images
note = await runTool('pdf-to-images', ['test/sample.pdf'])
log('pdf to images runs', note.includes('image'), note.slice(0, 80))

// 13. images to pdf (use the home screenshot as a big image)
note = await runTool('images-to-pdf', ['test/home.png'])
log('images to pdf runs', note.includes('combined'), note.slice(0, 80))

// 14. sanitize
note = await runTool('sanitize', ['test/sample.pdf'])
log('sanitize runs', note.toLowerCase().includes('stripped'), note.slice(0, 90))

// 15. metadata
note = await runTool('metadata', ['test/sample.pdf'])
log('metadata runs', note.includes('Metadata'), note.slice(0, 80))

// 16. contact sheet
note = await runTool('contact-sheet', ['test/sample.pdf'])
log('contact sheet runs', note.includes('arranged'), note.slice(0, 80))

// 17. organize (custom)
await page.goto(BASE + '/tools/organize', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf'])
await page.waitForSelector('.page-card', { timeout: 30000 })
const pageCards = await page.locator('.page-card').count()
log('organize thumbnails', pageCards === 3, `${pageCards} cards`)
await page.locator('.page-actions button').nth(1).click() // rotate right
await page.click('.organize-actions button.btn-primary')
await page.waitForSelector('.result', { timeout: 30000 })
log('organize exports', (await page.textContent('.result')).includes('ready'))
await shot('organize')

// 18. sign (custom)
await page.goto(BASE + '/tools/sign', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', ['test/sample.pdf'])
await page.waitForSelector('.sign-canvas img', { timeout: 30000 })
const pad = await page.locator('.sig-pad').boundingBox()
await page.mouse.move(pad.x + 40, pad.y + 90)
await page.mouse.down()
for (let i = 0; i < 24; i++) {
  await page.mouse.move(pad.x + 40 + i * 8, pad.y + 90 + Math.sin(i / 2) * 22)
}
await page.mouse.up()
await page.getByRole('button', { name: 'Use signature' }).click()
await page.waitForSelector('.sign-stamp', { timeout: 10000 })
const box = await page.locator('.sign-canvas').boundingBox()
await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.72)
await page.getByRole('button', { name: 'Apply signature' }).click()
await page.waitForSelector('.result', { timeout: 30000 })
log('sign applies', (await page.textContent('.result')).includes('Signed PDF'))
await shot('sign')

// 19. mobile
const mobile = await context.newPage()
await mobile.setViewportSize({ width: 390, height: 844 })
await mobile.goto(BASE + '/', { waitUntil: 'networkidle' })
await mobile.waitForTimeout(700)
await mobile.screenshot({ path: 'test/mobile.png', fullPage: true })

// 20. network guard
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const guardText = await page.textContent('.footer .privacy-pill')
log('no external requests', external.length === 0, `${external.length} external`)
log('guard reports clean', /0 external/.test(guardText), guardText.trim())
log('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '))

console.log('\nSUMMARY')
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.step}${r.extra ? ' — ' + r.extra : ''}`)
console.log(`\nExternal requests: ${external.length}`)
if (external.length) console.log(external.slice(0, 10))
console.log(`Errors: ${errors.length}`)
if (errors.length) console.log(errors.slice(0, 10))

await browser.close()
process.exit(results.every((r) => r.ok) && external.length === 0 && errors.length === 0 ? 0 : 1)
