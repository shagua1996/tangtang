const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-history-labels-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(require('electron'), [path.join(__dirname, 'seed.cjs'), data], {
  env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8',
})
assert.equal(seed.status, 0, seed.stderr)
let app
async function launch() {
  app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  return page
}
async function main() {
  let page = await launch()
  await page.evaluate(async () => {
    const header = await window.tangtang.getOrderHeader('20261115202')
    const { items } = await window.tangtang.listOrderItems({ orderId: header.orderId })
    await window.tangtang.createOrder({
      ...header, orderId: 'LABEL-HISTORY',
      orderForm: { ...header.orderForm, no: 'LABEL-HISTORY', orderNote: '整单标签备注' },
      sizeList: ['首张型号', '第二张型号', '末张型号'].map(type => ({ ...items[0], type, number: 9, sizeNote: '不要用于标签的单条备注' })),
    })
    const settings = await window.tangtang.getSettings()
    settings.baseForm.doorWidthDiff = 999
    await window.tangtang.saveSettings(settings)
  })
  // A fresh process must reconstruct labels solely from stored order snapshots.
  await app.close()
  page = await launch()
  await app.evaluate(({ app }) => {
    global.labelProof = []
    app.on('browser-window-created', (_, win) => {
      // Only substitute the native printer handoff; use real IPC/window/template/data.
      win.webContents.print = async (options, callback) => {
        try {
          const proof = await win.webContents.executeJavaScript(`({
            fields: [...document.querySelectorAll('.document-label-row strong')].map(el => el.textContent),
            orderId: new URLSearchParams(location.search).get('orderId'),
            itemIndex: new URLSearchParams(location.search).get('itemIndex'),
            cards: document.querySelectorAll('.document-label').length
          })`)
          global.labelProof.push({ ...proof, options })
          global.finishLabelPrint = callback
        } catch (error) { callback(false, error.message) }
      }
    })
  })
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  const detail = page.locator('.history-detail')
  const search = page.getByLabel('搜索订单')
  await search.fill('LABEL-HISTORY')
  await expect(detail.locator('.document-number')).toContainText('LABEL-HISTORY')
  await expect(detail.getByRole('tab', { name: '标签', exact: true })).toBeVisible()
  await detail.getByRole('tab', { name: '标签', exact: true }).click()
  const cards = detail.locator('.document-label-item')
  await expect(cards).toHaveCount(3)
  const expected = ['客户202', '浙江省永康市', '第二张型号', '原木', '900*2100*150', '820*2060', '外左开', '整单标签备注']
  assert.deepEqual(await cards.nth(1).locator('strong').allTextContents(), expected)
  await expect(detail.locator('table,input,.el-pagination')).toHaveCount(0)
  await expect(detail).not.toContainText('不要用于标签的单条备注')
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
  await page.screenshot({ path: path.join(root, 'test-results/history-labels.png') })
  for (const [attempt, index] of [1, 2, 0].entries()) {
    await cards.nth(index).getByRole('button', { name: '打印', exact: true }).click()
    await expect.poll(async () => app.evaluate(() => global.labelProof.length)).toBe(attempt + 1)
    const proof = await app.evaluate(() => global.labelProof.at(-1))
    assert.equal(proof.orderId, 'LABEL-HISTORY')
    assert.equal(proof.itemIndex, String(index))
    assert.equal(proof.cards, 1)
    assert.deepEqual(proof.fields, await cards.nth(index).locator('strong').allTextContents())
    assert.equal(proof.options.pageSize, undefined)
    for (const button of await detail.getByRole('button', { name: '打印', exact: true }).all())
      await expect(button).toBeDisabled()
    await app.evaluate((_electron, attempt) => {
      global.finishLabelPrint(attempt === 2, attempt === 0 ? 'cancelled' : '标签打印测试失败')
    }, attempt)
    await expect(cards.first().getByRole('button', { name: '打印', exact: true })).toBeEnabled()
    await expect.poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    if (attempt === 1) await expect(page.getByText('标签打印测试失败', { exact: true })).toBeVisible()
  }
  // Changing the selected order resets the tab and must never reuse old labels.
  await search.fill('客户201')
  await expect(detail.locator('.document-number')).toContainText('20261115201')
  await expect(detail.getByRole('tab', { name: '销售单', exact: true })).toHaveAttribute('aria-selected', 'true')
  await detail.getByRole('tab', { name: '标签', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('客户201')
  await expect(cards.first()).not.toContainText('第二张型号')
  await search.fill('LABEL-HISTORY')
  await expect(detail.locator('.document-number')).toContainText('LABEL-HISTORY')
  await detail.getByRole('button', { name: '删除', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '删除订单', exact: true })
  await expect(dialog).toContainText('标签')
  await expect(dialog).toContainText('无法恢复')
  await dialog.getByRole('button', { name: '删除', exact: true }).click()
  await expect(detail.getByRole('tab')).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.tangtang.getOrderHeader('LABEL-HISTORY')), null)
  assert.equal((await page.evaluate(() => window.tangtang.listOrderItems({ orderId: 'LABEL-HISTORY' }))).items.length, 0)
  await app.close()
  page = await launch()
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  await page.getByLabel('搜索订单').fill('LABEL-HISTORY')
  await expect(page.locator('.history-list')).toContainText('没有匹配的订单')
  await expect(page.locator('.history-detail .document-label')).toHaveCount(0)
  console.log('history-labels: persisted snapshots after restart/settings changes, eight fields, correct second/last/first print, cancellation/failure recovery, switch and permanent deletion passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await app?.close()
  fs.rmSync(data, { recursive: true, force: true })
})
