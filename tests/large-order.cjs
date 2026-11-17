const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-large-order-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(require('electron'), [path.join(__dirname, 'seed.cjs'), data], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
assert.equal(seed.status, 0, seed.stderr)
let app
async function main() {
  app = await electron.launch({ args: [root], cwd: root, env })
  const page = await app.firstWindow()
  page.on('crash', () => console.error('large-order: renderer crashed'))
  await page.locator('.calculator-content .input-panel h2').waitFor()
  await page.evaluate(async () => {
    const header = await window.tangtang.getOrderHeader('20261115202')
    const { items } = await window.tangtang.listOrderItems({ orderId: header.orderId })
    await window.tangtang.createOrder({ ...header, orderId: 'LARGE-ORDER', orderForm: { ...header.orderForm, no: 'LARGE-ORDER' }, sizeList: Array.from({ length: 10000 }, (_, i) => ({ ...items[0], type: 'MODEL-' + (i + 1) })) })
  })
  await page.locator('nav').getByRole('button', { name: '历史记录', exact: false }).click()
  const started = Date.now()
  await page.getByLabel('搜索订单').fill('LARGE-ORDER')
  await expect(page.locator('.history-detail .document-line')).toHaveCount(10000, { timeout: 30000 })
  const elapsedMs = Date.now() - started
  await expect(page.locator('.history-detail .document-line').last()).toContainText('MODEL-10000')
  await expect(page.locator('.history-detail .el-pagination')).toHaveCount(0)
  const memory = await app.evaluate(({ app }) => app.getAppMetrics().map((process) => ({ type: process.type, workingSetKiB: process.memory.workingSetSize })))
  const scroll = await page.evaluate(() => {
    const outer = document.querySelector('.history-page'), detail = document.querySelector('.history-detail'), list = document.querySelector('.summary-list')
    detail.scrollTop = detail.scrollHeight
    return { outer: outer.scrollHeight <= outer.clientHeight + 1, detailScroll: detail.scrollTop, listScroll: list.scrollTop }
  })
  assert.equal(scroll.outer, true)
  assert.ok(scroll.detailScroll > 0)
  const labelStarted = Date.now()
  await page.locator('.history-detail').getByRole('tab', { name: '标签', exact: true }).click()
  await expect(page.locator('.history-detail .document-label')).toHaveCount(10000, { timeout: 30000 })
  await expect(page.locator('.history-detail .document-label').last()).toContainText('MODEL-10000')
  const labelRenderMs = Date.now() - labelStarted
  const labelScroll = await page.evaluate(() => {
    const outer = document.querySelector('.history-page'), detail = document.querySelector('.history-detail')
    detail.scrollTop = detail.scrollHeight
    return { outer: outer.scrollHeight <= outer.clientHeight + 1, detailScroll: detail.scrollTop }
  })
  assert.equal(labelScroll.outer, true)
  assert.ok(labelScroll.detailScroll > 0)
  await expect(page.locator('.history-detail .el-pagination')).toHaveCount(0)
  const labelMemory = await app.evaluate(({ app }) => app.getAppMetrics().map(p => ({ type: p.type, workingSetKiB: p.memory.workingSetSize })))
  const switchStarted = Date.now()
  await page.locator('.history-tools input[type="text"]').fill('客户201')
  await expect(page.locator('.history-detail').getByRole('tab', { name: '标签', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.history-detail .document-label')).toHaveCount(1)
  await expect(page.locator('.history-detail .document-label')).toContainText('客户201')
  await expect(page.locator('.history-detail .document-label')).not.toContainText('MODEL-10000')
  const labelSwitchMs = Date.now() - switchStarted
  const report = { passed: true, rows: 10000, searchAndFullRenderMs: elapsedMs, labelRenderMs, labelSwitchMs, labelScroll, labelMemory, labelWorkingSetMiB: labelMemory.reduce((sum, p) => sum + p.workingSetKiB, 0) / 1024, finalLinePresent: true, noDetailPagination: true, scroll, memory, workingSetMiB: memory.reduce((sum, p) => sum + p.workingSetKiB, 0) / 1024, caveat: 'Single run, warm cache, sampled process working sets; not a continuous memory peak or minimum-machine guarantee.' }
  const out = path.join(root, 'test-results/coverage-2026-11-17/large-order.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => { await app?.close(); fs.rmSync(data, { recursive: true, force: true }) })
