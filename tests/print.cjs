const { _electron: electron } = require('@playwright/test')
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-print-')),
  out = path.join(root, 'test-results')
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(
  require('electron'),
  [path.join(__dirname, 'seed.cjs'), data],
  { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' },
)
assert.equal(seed.status, 0, seed.stderr)
let app
async function main() {
  app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  // Intercept only the OS print handoff to avoid consuming paper. Real templates, IPC,
  // windows, data loading, Chromium layout/PDF generation and cleanup remain exercised.
  await app.evaluate(({ app }, directory) => {
    const fileSystem = process.mainModule.require('node:fs'),
      pathModule = process.mainModule.require('node:path')
    global.printProof = []
    global.cancelNextPrint = false
    app.on('browser-window-created', (_, win) => {
      win.webContents.print = async (options, callback) => {
        try {
          if (global.cancelNextPrint) {
            global.cancelNextPrint = false
            callback(false, 'cancelled by test')
            return
          }
          const proof = await win.webContents.executeJavaScript(
            '({rows:document.querySelectorAll("tbody tr").length,text:document.body.innerText,kind:new URLSearchParams(location.search).get("kind")})',
          )
          if (proof.kind !== 'label' && options.landscape !== false)
            throw new Error('订单必须使用纵向打印参数')
          const start = Date.now()
          const pdf = await win.webContents.printToPDF({
            landscape: options.landscape,
            printBackground: true,
            preferCSSPageSize: true,
            pageSize: 'A4',
          })
          const mediaBox = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/)
          if (!mediaBox) throw new Error('PDF纸张尺寸缺失')
          const paper = {width:Number(mediaBox[3])-Number(mediaBox[1]),height:Number(mediaBox[4])-Number(mediaBox[2])}
          if (proof.kind !== 'label' && paper.width >= paper.height)
            throw new Error('订单PDF必须为纵向纸张')
          fileSystem.writeFileSync(
            pathModule.join(directory, proof.kind + '.pdf'),
            pdf,
          )
          global.printProof.push({
            kind: proof.kind,
            paper,
            rows: proof.rows,
            lastRow: proof.text.includes('LAST-LINE-10000'),
            bytes: pdf.length,
            ms: Date.now() - start,
            options,
          })
          callback(true)
        } catch (error) {
          callback(false, error.message)
        }
      }
    })
  }, out)
  await page.evaluate(async () => {
    const sample = await window.tangtang.listOrderItems({
      orderId: '20261115202',
      offset: 0,
      limit: 1,
    })
    const header = await window.tangtang.getOrderHeader('20261115202')
    await window.tangtang.createOrder({
      ...header,
      _id: undefined,
      orderId: 'PRINT-STRESS',
      orderForm: { ...header.orderForm, no: 'PRINT-STRESS' },
      sizeList: Array.from({ length: 10000 }, (_, i) => ({
        ...sample.items[0],
        sizeNote: i === 9999 ? 'LAST-LINE-10000' : '第' + (i + 1) + '条',
      })),
      totalPrice: 20000000,
    })
  })
  await page.evaluate(() =>
    window.tangtang.printOrder({ orderId: '20261115202', kind: 'sale' }),
  )
  await page.evaluate(() =>
    window.tangtang.printOrder({ orderId: 'PRINT-STRESS', kind: 'production' }),
  )
  await page.evaluate(() =>
    window.tangtang.printOrder({
      orderId: 'PRINT-STRESS',
      kind: 'label',
      itemIndex: 9999,
    }),
  )
  const proof = await app.evaluate(() => global.printProof)
  assert.equal(proof[0].rows, 6)
  assert.equal(proof[1].rows, 10000)
  assert.equal(proof[1].lastRow, true)
  assert.equal(proof[2].rows, 0)
  assert.ok(proof.every((p) => p.bytes > 1000))
  assert.deepEqual(proof[2].options.pageSize, { width: 60000, height: 60000 })
  assert.equal(proof[2].options.scaleFactor, 100)
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
    1,
  )
  await app.evaluate(() => {
    global.cancelNextPrint = true
  })
  const cancellation = await page.evaluate(async () => {
    try {
      await window.tangtang.printOrder({ orderId: '20261115202', kind: 'sale' })
      return false
    } catch {
      return true
    }
  })
  assert.equal(cancellation, true)
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
    1,
  )
  console.log(
    JSON.stringify({
      passed: true,
      proof,
      cancellationReleasedWindow: true,
      physicalPrinterTested: false,
    }),
  )
  await app.close()
  app = null
}
main().catch(async (error) => {
  console.error(error)
  await app?.close().catch(() => {})
  process.exitCode = 1
})
