const { _electron: electron } = require('@playwright/test')
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-ui-')),
  out = path.join(root, 'test-results')
fs.mkdirSync(out, { recursive: true })
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
async function waitCount(locator, count) {
  for (let n = 0; n < 100; n++) {
    if ((await locator.count()) === count) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.equal(await locator.count(), count)
}
async function main() {
  app = await electron.launch({ args: [root], cwd: root, env, timeout: 30000 })
  const page = await app.firstWindow(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.locator('.calculator-content .input-panel h2').waitFor()
  // Native ABI and real preload/database are used; no browser mock backend.
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  assert.equal(
    (await page.evaluate(() => window.tangtang.getStatus())).ready,
    true,
  )
  const nums = page.locator('.calculator-form input[type=number]')
  await nums.nth(0).fill('900')
  await nums.nth(1).fill('2100')
  await nums.nth(2).fill('150')
  await nums.nth(4).fill('2')
  await nums.nth(5).fill('1000')
  await page.getByRole('button', { name: '计算并加入明细' }).click()
  await page
    .locator('.result-panel')
    .getByText('820*2060', { exact: true })
    .waitFor()
  await page.screenshot({ path: path.join(out, 'calculator.png') })
  await page.getByRole('button', { name: '生成生产单和销售单' }).click()
  const modal = page.getByRole('dialog')
  await modal.waitFor()
  await modal.locator('input').nth(4).fill('新订单客户')
  await modal.getByRole('button', { name: '创建订单', exact: true }).click()
  await page.locator('.order-view .document-title').waitFor()
  assert.equal(
    await page.locator('.order-view table.document-table').count(),
    1,
    'Order must use the legacy document table',
  )
  await page.locator('.document-detail-input').nth(0).fill('1800')
  await page.locator('.document-detail-input').nth(1).fill('1000')
  await page.getByRole('button', { name: '确认并保存' }).click()
  await page.getByText('订单已保存', { exact: true }).waitFor()
  const orderId = await page.locator('.order-view .document-number').innerText()
  await page.screenshot({ path: path.join(out, 'current-order.png') })
  await page.getByRole('button', { name: '历史记录', exact: false }).click()
  await page.locator('.summary-item').first().waitFor()
  assert.equal(await page.locator('.summary-item').count(), 100)
  const latest = await page.evaluate(() =>
    window.tangtang.listOrders({
      page: 1,
      pageSize: 100,
      search: '新订单客户',
    }),
  )
  assert.equal(latest.total, 1)
  assert.equal(latest.items[0].itemCount, 1)
  const header = await page.evaluate(
    (id) => window.tangtang.getOrderHeader(id),
    latest.items[0].orderId,
  )
  assert.equal(header.detailForm.yingPay, '1800')
  assert.equal(header.detailForm.amountPay, '1000')
  await page.getByLabel('搜索订单').fill('客户202')
  await waitCount(page.locator('.summary-item'), 1)
  await page.getByText('20261115202', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(out, 'history.png') })
  await page.getByLabel('搜索订单').fill('不存在的客户')
  await page.getByText('没有匹配的订单', { exact: true }).waitFor()
  await page.getByLabel('搜索订单').fill('')
  await waitCount(page.locator('.summary-item'), 100)
  // A large single order retains its selected production tab across detail pages.
  await page.evaluate(async () => {
    const old = await window.tangtang.getOrderHeader('20261115202')
    const { items } = await window.tangtang.listOrderItems({
      orderId: old.orderId,
    })
    await window.tangtang.createOrder({
      ...old,
      orderId: 'PAGING-TEST',
      orderForm: { ...old.orderForm, no: 'PAGING-TEST' },
      sizeList: Array.from({ length: 205 }, () => items[0]),
    })
  })
  await page.getByLabel('搜索订单').fill('PAGING-TEST')
  await waitCount(page.locator('.summary-item'), 1)
  await page.getByText('PAGING-TEST', { exact: true }).click()
  await page
    .locator('.history-detail')
    .getByRole('tab', { name: '生产单' })
    .click()
  assert.equal(
    await page
      .locator('.history-detail')
      .getByRole('button', { name: '删除', exact: true })
      .count(),
    0,
  )
  assert.equal(
    await page.locator('.history-detail .document-line').count(),
    205,
  )
  assert.equal(await page.locator('.history-detail .el-pagination').count(), 0)
  const scrollBounds = await page.evaluate(() => {
    const outer=document.querySelector('.history-page'),left=document.querySelector('.summary-list'),right=document.querySelector('.history-detail')
    left.scrollTop=60;right.scrollTop=120
    return {outerHeight:outer.clientHeight,outerContent:outer.scrollHeight,outerScroll:outer.scrollTop,pageScroll:document.documentElement.scrollTop,rightScroll:right.scrollTop,rightHeight:right.clientHeight,rightContent:right.scrollHeight,leftHeight:left.clientHeight,leftContent:left.scrollHeight}
  })
  assert.ok(scrollBounds.outerContent<=scrollBounds.outerHeight+1,JSON.stringify(scrollBounds))
  assert.equal(scrollBounds.outerScroll,0)
  assert.equal(scrollBounds.pageScroll,0)
  assert.ok(scrollBounds.rightScroll>0,JSON.stringify(scrollBounds))
  assert.equal(
    await page
      .locator('.history-detail .document-line')
      .last()
      .locator('td')
      .first()
      .innerText(),
    '205',
  )
  await page
    .locator('.history-detail')
    .getByRole('tab', { name: '销售单' })
    .click()
  await page
    .locator('.history-detail')
    .getByRole('button', { name: '删除', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '删除订单' })
    .getByRole('button', { name: '删除', exact: true })
    .click()
  await page.getByText('订单已删除', { exact: true }).waitFor()
  await page.getByRole('button', { name: '设置', exact: false }).click()
  await page.getByRole('heading', { name: '尺寸计算参数' }).waitFor()
  await page.screenshot({ path: path.join(out, 'settings.png') })
  // Confirm at minimum native window dimensions; scroll is intentional inside workspace.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1024, 600),
  )
  await page.getByRole('button', { name: '尺寸计算', exact: false }).click()
  const fit = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  assert.ok(fit.scroll <= fit.client + 1, JSON.stringify(fit))
  await page.screenshot({ path: path.join(out, 'calculator-1024.png') })
  assert.deepEqual(errors, [])
  await app.close()
  app = null
  // Reopen the same real DB; saved order remains, unsaved calculation session does not.
  app = await electron.launch({ args: [root], cwd: root, env, timeout: 30000 })
  const reopened = await app.firstWindow()
  await reopened
    .locator('.calculator-content .input-panel h2')
    .waitFor()
  const persisted = await reopened.evaluate(() =>
    window.tangtang.listOrders({ search: '新订单客户' }),
  )
  assert.equal(persisted.total, 1)
  assert.equal(await reopened.locator('.result-panel .vt-row').count(), 0)
  await app.close()
  app = null
  console.log(
    JSON.stringify({
      passed: true,
      orderId,
      screenshots: out,
      testDatabase: data,
      checks: [
        'real Electron22 ABI',
        'isolated preload',
        'calculate/create/save',
        '100 row pagination',
        'search/empty',
        'settings',
        '1024 fit',
        'restart persistence',
      ],
    }),
  )
}
main().catch(async (error) => {
  console.error(error)
  if (app) {
    const pages = app.windows()
    await pages[0]
      ?.screenshot({ path: path.join(out, 'failure.png') })
      .catch(() => {})
    await app.close().catch(() => {})
  }
  process.exitCode = 1
})
