const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-startup-'))
const legacy = path.join(temporary, '旧版数据')
fs.mkdirSync(legacy)
const files = {
  'order.db': JSON.stringify({ _id: 'legacy-one', orderId: 'OLD-001', orderForm: { no: 'OLD-001', clientName: '迁移客户' }, sizeList: [{ holeSize: '900*2100*240', singlePrice: 100 }], totalPrice: 100 }),
  'case.db': JSON.stringify({ _id: 'calc-one', holeWidth: 900 }),
  'setting.db': JSON.stringify({ _id: 'settings-one', version: 1, baseForm: { doorWidthDiff: 99 } }),
}
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(legacy, name), text)
let app
async function launch(directory) {
  const env = { ...process.env, TANGTANG_DATA_DIR: directory }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.TANGTANG_DEV_URL
  app = await electron.launch({ args: [root], cwd: root, env })
  return app.firstWindow()
}
async function main() {
  const empty = path.join(temporary, '空白应用数据')
  let page = await launch(empty)
  await expect(page.getByRole('heading', { name: '欢迎使用芃悦居工作台' })).toBeVisible()
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }) })
  await page.getByRole('button', { name: '全新开始', exact: true }).click()
  await expect(page.getByText('已取消初始化', { exact: true })).toBeVisible()
  assert.equal((await page.evaluate(() => window.tangtang.getStatus())).ready, false)
  assert.equal(fs.existsSync(path.join(empty, 'development-db/tangtang.sqlite')), false)
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }) })
  await page.getByRole('button', { name: '全新开始', exact: true }).click()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  const setting = await page.evaluate(() => window.tangtang.getSettings())
  assert.equal(setting.baseForm.doorWidthDiff, 80)
  assert.deepEqual(setting.typeOptions, [])
  assert.equal((await page.evaluate(() => window.tangtang.listOrders())).total, 0)
  await app.close()
  page = await launch(empty)
  await page.locator('.calculator-content .input-panel h2').waitFor()
  assert.equal((await page.evaluate(() => window.tangtang.getStatus())).ready, true)
  await app.close()
  const migrated = path.join(temporary, '迁移应用数据')
  page = await launch(migrated)
  await expect(page.getByRole('heading', { name: '欢迎使用芃悦居工作台' })).toBeVisible()
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }) })
  await page.getByRole('button', { name: '选择旧数据目录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '欢迎使用芃悦居工作台' })).toBeVisible()
  assert.equal((await page.evaluate(() => window.tangtang.getStatus())).ready, false)
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }) }, legacy)
  await page.getByRole('button', { name: '选择旧数据目录', exact: true }).click()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  assert.equal((await page.evaluate(() => window.tangtang.listOrders())).total, 1)
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  const detail = page.locator('.history-detail')
  await detail.getByRole('tab', { name: '标签', exact: true }).click()
  await expect(detail.locator('.document-label')).toHaveCount(1)
  assert.deepEqual(await detail.locator('.document-label-row strong').allTextContents(), [
    '迁移客户', '', '', '', '900*2100*240', '', '', '',
  ])
  assert.equal((await page.evaluate(() => window.tangtang.getSettings())).baseForm.doorWidthDiff, 99)
  for (const [name, text] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(legacy, name), 'utf8'), text)
  await app.close()
  page = await launch(migrated)
  await page.locator('.calculator-content .input-panel h2').waitFor()
  assert.equal((await page.evaluate(() => window.tangtang.listOrders())).total, 1)
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  await page.locator('.history-detail').getByRole('tab', { name: '标签', exact: true }).click()
  await expect(page.locator('.history-detail .document-label')).toContainText('迁移客户')
  console.log('startup: explicit empty initialization/cancellation, default settings, Chinese path migration, source preservation and no repeated migration passed; native picker decisions supplied by fixture')
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await app?.close()
  fs.rmSync(temporary, { recursive: true, force: true })
})
