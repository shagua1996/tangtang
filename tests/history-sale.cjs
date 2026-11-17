const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'), data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-history-sale-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(require('electron'), ['tests/seed.cjs', data], { cwd: root, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
assert.equal(seed.status, 0, seed.stderr)
function sql(statement) {
  const result = spawnSync(require('electron'), ['-e', 'const {Repository}=require(process.argv[1]);const db=new Repository(process.argv[2]);db.db.exec(process.argv[3]);db.close()', path.join(root, 'desktop/database.cjs'), path.join(data, 'development-db/tangtang.sqlite'), statement], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}
let app
async function launch() {
  app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  await expect(page.locator('.history-detail .document-number')).toContainText('20261115202')
  return page
}
async function main() {
  let page = await launch()
  let detail = page.locator('.history-detail')
  await expect(detail.locator('.document-detail-input')).toHaveCount(7)
  await expect(detail.locator('.document-header-input')).toHaveCount(6)
  await detail.getByLabel('订单备注', { exact: true }).fill('历史销售备注\n第二行')
  const headerValues = ['新经销商', '新经销商地址', '00123456789', '历史新客户', '历史新客户地址', '2026-12-01']
  for (let i = 0; i < headerValues.length; i++) await detail.locator('.document-header-input').nth(i).fill(headerValues[i])
  const weights = await detail.evaluate(el => ({
    labels: [...el.querySelectorAll('.document-field > span:first-child')].map(e => getComputedStyle(e).fontWeight),
    inputs: [...el.querySelectorAll('input')].map(e => getComputedStyle(e).fontWeight),
  }))
  assert.ok(weights.labels.every(w => Number(w) >= 600))
  assert.ok(weights.inputs.every(w => w === '400'))
  await expect(detail.getByLabel('销售单位', { exact: true })).toHaveValue('浙江永康芃悦居木门有限公司')
  assert.equal((await page.evaluate(() => window.tangtang.getOrderHeader('20261115202'))).detailForm, undefined, 'Viewing defaults must not write the order')
  const values = ['1234', '567', '历史销售单位', '历史地址', '历史联系人', '01012345678', '历史收货人']
  for (let i = 0; i < values.length; i++) await detail.locator('.document-detail-input').nth(i).fill(values[i])
  await detail.getByRole('button', { name: '确认并保存', exact: true }).click()
  await expect(page.getByText('订单已保存', { exact: true })).toBeVisible()
  await detail.getByRole('tab', { name: '生产单', exact: true }).click()
  await expect(detail.locator('input')).toHaveCount(0)
  await expect(detail.getByRole('button', { name: '确认并保存', exact: true })).toHaveCount(0)
  await app.close()
  page = await launch()
  detail = page.locator('.history-detail')
  await expect(detail.getByLabel('订单备注', { exact: true })).toHaveValue('历史销售备注\n第二行')
  for (let i = 0; i < headerValues.length; i++) await expect(detail.locator('.document-header-input').nth(i)).toHaveValue(headerValues[i])
  await expect(page.locator('.summary-item.selected')).toContainText('历史新客户')
  assert.equal((await page.evaluate(() => window.tangtang.listOrders({ search: '00123456789' }))).total, 1)
  for (let i = 0; i < values.length; i++) await expect(detail.locator('.document-detail-input').nth(i)).toHaveValue(values[i])
  await app.evaluate(({ app }) => {
    global.saleProof = []
    global.headerProof = []
    global.noteProof = []
    app.on('browser-window-created', (_, win) => {
      win.webContents.print = async (_options, callback) => {
        global.saleProof.push(await win.webContents.executeJavaScript("[...document.querySelectorAll('.document-field-value')].map(el=>el.textContent)"))
        global.headerProof.push(await win.webContents.executeJavaScript("[...document.querySelectorAll('.document-header-value')].map(el=>el.textContent)"))
        global.noteProof.push(await win.webContents.executeJavaScript("document.querySelector('.document-note-value').textContent"))
        callback(true)
      }
    })
  })
  await detail.getByLabel('实付金额', { exact: true }).fill('999')
  await detail.getByLabel('订单备注', { exact: true }).fill('打印前修改备注\n第二行')
  sql("CREATE TRIGGER fail_history_save BEFORE UPDATE ON orders BEGIN SELECT RAISE(ABORT, 'history save failure'); END")
  await detail.getByRole('button', { name: '打印', exact: true }).click()
  await expect(page.getByText('history save failure', { exact: true })).toBeVisible()
  assert.deepEqual(await app.evaluate(() => global.saleProof), [])
  await expect(detail.getByLabel('实付金额', { exact: true })).toHaveValue('999')
  await expect(detail.getByLabel('订单备注', { exact: true })).toHaveValue('打印前修改备注\n第二行')
  sql('DROP TRIGGER fail_history_save')
  await detail.getByRole('button', { name: '打印', exact: true }).click()
  await expect.poll(async () => app.evaluate(() => global.saleProof.length)).toBe(1)
  values[1] = '999'
  assert.deepEqual(await app.evaluate(() => global.saleProof[0]), values)
  assert.deepEqual(await app.evaluate(() => global.headerProof[0]), headerValues)
  assert.equal(await app.evaluate(() => global.noteProof[0]), '打印前修改备注\n第二行')
  const saved = await page.evaluate(() => window.tangtang.getOrderHeader('20261115202'))
  assert.equal(saved.detailForm.amountPay, '999')
  assert.equal(saved.totalPrice, 2000)
  await expect(detail.getByRole('button', { name: '删除', exact: true })).toBeEnabled()
  await detail.getByLabel('销售单位', { exact: true }).fill('')
  await detail.getByLabel('订单备注', { exact: true }).fill('')
  await detail.getByRole('button', { name: '确认并保存', exact: true }).click()
  await expect.poll(async () => page.evaluate(async () => (await window.tangtang.getOrderHeader('20261115202')).detailForm.saleCompany)).toBe('')
  await page.locator('.summary-item').filter({ hasText: '20261115201' }).click()
  await expect(detail.getByLabel('实付金额', { exact: true })).toHaveValue('')
  await page.locator('.summary-item').filter({ hasText: '20261115202' }).click()
  await expect(detail.getByLabel('销售单位', { exact: true })).toHaveValue('')
  await expect(detail.getByLabel('订单备注', { exact: true })).toHaveValue('')
  await expect(detail.getByLabel('实付金额', { exact: true })).toHaveValue('999')
  console.log('history-sale: seven fields/defaults, save/restart, print after save, failure retention/no print, explicit empty values and order isolation passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await app?.close(); fs.rmSync(data, { recursive: true, force: true }) })
