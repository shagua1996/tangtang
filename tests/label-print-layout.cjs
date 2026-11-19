const { _electron: electron } = require('@playwright/test')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { spawnSync } = require('node:child_process')
const { inflateSync } = require('node:zlib')
const root = path.resolve(__dirname, '..'), data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-label-layout-'))
const out = path.join(root, 'test-results', 'label-60mm-final')
fs.mkdirSync(out, { recursive: true })
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE; delete env.TANGTANG_DEV_URL
assert.equal(spawnSync(require('electron'), ['tests/seed.cjs', data], { cwd: root, env: { ...env, ELECTRON_RUN_AS_NODE: '1' } }).status, 0)
let app
async function main() {
  app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  await page.locator('.calculator-form').waitFor()
  await app.evaluate(({ app }, out) => {
    const fileSystem = process.mainModule.require('node:fs'), paths = process.mainModule.require('node:path')
    global.labelProof = []
    app.on('browser-window-created', (_, win) => {
      win.webContents.print = async (options, callback) => {
        try {
          const layout = await win.webContents.executeJavaScript(`(() => {
            const label = document.querySelector('.document-label'), address = label.querySelectorAll('strong')[1];
            return { font: getComputedStyle(label).fontSize, width: label.getBoundingClientRect().width,
              height: label.getBoundingClientRect().height, addressHeight: address.getBoundingClientRect().height,
              lineHeight: parseFloat(getComputedStyle(address).lineHeight), rows: [...label.children].map(row => ({text:row.textContent,height:row.getBoundingClientRect().height})), text: label.innerText }
          })()`)
          const pdf = await win.webContents.printToPDF({ pageSize: { width: 60 / 25.4, height: 60 / 25.4 }, preferCSSPageSize: true, scale: 1, printBackground: true })
          const file = paths.join(out, 'label-' + global.labelProof.length + '.pdf')
          fileSystem.writeFileSync(file, pdf)
          global.labelProof.push({ options, layout, file, pages: (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, boxes: pdf.toString('latin1').match(/\/MediaBox\s*\[[^\]]+\]/g) })
          callback(true)
        } catch (error) { callback(false, error.message) }
      }
    })
  }, out)
  await page.evaluate(async () => {
    for (const [id, address, note] of [
      ['ONE', '巴东大支坪', '铝卡边'],
      ['TWO', '湖北省恩施州巴东县大支坪镇', '铝卡边'],
      ['ADDRESS', '超长客户地址'.repeat(20), '铝卡边'],
      ['NOTE', '巴东大支坪', '超长工艺备注'.repeat(40)],
    ]) await window.tangtang.createOrder({ orderId: id, orderForm: { clientName: 'MJ李永安', clientAddress: address }, sizeList: [{ type: '009', color: '皇家古木', holeSize: '880*2090*150', doorSize: '805*2055', openDirection: '内右开', sizeNote: note }], totalPrice: 0 })
  })
  for (const id of ['ONE', 'TWO']) await page.evaluate(orderId => window.tangtang.printOrder({ orderId, kind: 'label', itemIndex: 0 }), id)
  const proof = await app.evaluate(() => global.labelProof)
  for (const p of proof) {
    assert.deepEqual(p.options.pageSize, { width: 60000, height: 60000 })
    assert.equal(p.options.scaleFactor, 100)
    assert.equal(p.layout.font, '20px')
    assert.ok(Math.abs(p.layout.width - 58 * 96 / 25.4) < 1)
    assert.ok(p.pages >= 1)
    assert.ok(p.boxes.every(box => /169\.92/.test(box)), JSON.stringify(p.boxes))
    // Check physical text scale in the generated PDF, not just CSS font-size.
    const bytes = fs.readFileSync(p.file), source = bytes.toString('latin1')
    const sizes = []
    for (const match of source.matchAll(/stream\r?\n/g)) {
      let text
      try { text = inflateSync(bytes.subarray(match.index + match[0].length, source.indexOf('endstream', match.index))).toString() } catch { continue }
      if (!text.includes(' Tf')) continue
      const matrices = [...text.matchAll(/([-\d.]+) 0 0 [-\d.]+ [-\d.]+ [-\d.]+ cm/g)]
      assert.ok(matrices.length >= 2)
      const factor = Math.abs(Number(matrices[0][1]) * Number(matrices[1][1]))
      for (const font of text.matchAll(/\/F\d+ ([\d.]+) Tf/g)) sizes.push(Number(font[1]) * factor)
    }
    assert.ok(sizes.length > 0 && sizes.every(size => Math.abs(size - 15) < 0.06), 'PDF must retain 20px/15pt text: ' + sizes)
  }
  assert.ok(proof[1].layout.addressHeight > proof[1].layout.lineHeight, 'long address may wrap without blocking print')
  assert.equal(proof[0].pages, 1, 'eight normal rows fit one label')
  assert.ok(proof[0].layout.height <= 52 * 96 / 25.4, 'reserve bottom clearance for the last note row: ' + JSON.stringify(proof[0].layout))
  assert.ok(proof[0].layout.lineHeight >= 24, 'retain readable spacing between normal rows')
  for (const id of ['ADDRESS', 'NOTE']) {
    const error = await page.evaluate(async orderId => {
      try { await window.tangtang.printOrder({ orderId, kind: 'label', itemIndex: 0 }); return '' }
      catch (error) { return error.message }
    }, id)
    assert.equal(error, '', 'long content must be submitted without size validation')
    assert.equal(await app.evaluate(() => global.labelProof.length), id === 'ADDRESS' ? 3 : 4)
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1)
  }
  // Print queue remains usable after long labels.
  await page.evaluate(() => window.tangtang.printOrder({ orderId: 'ONE', kind: 'label', itemIndex: 0 }))
  assert.equal(await app.evaluate(() => global.labelProof.length), 5)
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  await page.getByRole('textbox', { name: '搜索订单', exact: true }).fill('MJ李永安')
  await page.locator('.history-detail').getByRole('tab', { name: '标签', exact: true }).click()
  const card = page.locator('.history-detail .document-label').first()
  await card.waitFor()
  assert.equal(await card.evaluate(el => getComputedStyle(el).fontSize), '16px', 'screen uses existing staged 16px setting')
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2))
  console.log('label-print-layout: 60mm, 20px, larger row spacing, eight rows fit one page, long content directly submitted and queue recovery passed')
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => { await app?.close(); fs.rmSync(data, { recursive: true, force: true }) })
