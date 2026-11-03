import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'node:fs'

async function make(path, label, pages = 3) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  doc.setTitle(`${label} title`)
  doc.setAuthor('Docsy Test')
  doc.setSubject('A sample document')
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595.28, 841.89])
    page.drawText(`${label} — page ${i}`, { x: 54, y: 770, size: 24, font: bold, color: rgb(0.08, 0.08, 0.1) })
    for (let l = 0; l < 12; l++) {
      page.drawText(
        `This is line ${l + 1} of selectable text. The quick brown fox jumps over the lazy dog.`,
        { x: 54, y: 720 - l * 22, size: 11, font, color: rgb(0.2, 0.2, 0.24) }
      )
    }
    page.drawRectangle({ x: 54, y: 380, width: 487, height: 120, color: rgb(0.94, 0.95, 0.92) })
    page.drawText(`Confidential-ish block ${i}`, { x: 80, y: 430, size: 18, font: bold, color: rgb(0.3, 0.4, 0.2) })
  }
  fs.writeFileSync(path, await doc.save())
  console.log('wrote', path)
}

fs.mkdirSync('test', { recursive: true })
await make('test/sample.pdf', 'Sample Document', 3)
await make('test/sample2.pdf', 'Second Document', 2)
