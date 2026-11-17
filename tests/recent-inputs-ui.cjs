const { _electron: electron } = require('@playwright/test')
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-recents-ui-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(require('electron'), ['tests/seed.cjs', data], {
  cwd: root,
  env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8',
})
assert.equal(seed.status, 0, seed.stderr)
let app
async function historyMatches(page, predicate) {
  for (let i = 0; i < 50; i++) {
    const records = await page.evaluate(() =>
      window.tangtang.getRecentOrderInputs(),
    )
    if (predicate(records)) return records
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Recent input persistence did not match expected state')
}
async function openOrder(page) {
  const numbers = page.locator('.calculator-form input[type=number]')
  for (let i = 0; i < 3; i++) {
    assert.equal(await numbers.nth(i).inputValue(), '')
    assert.equal(await numbers.nth(i).getAttribute('placeholder'), '0')
  }
  assert.equal(await numbers.nth(3).inputValue(), '45')
  await numbers.nth(0).fill('900')
  await numbers.nth(1).fill('2100')
  await numbers.nth(2).fill('150')
  await page.getByRole('button', { name: '重置', exact: true }).click()
  assert.equal(await numbers.nth(0).inputValue(), '')
  await numbers.nth(0).fill('900')
  await numbers.nth(1).fill('2100')
  await numbers.nth(2).fill('150')
  await page.getByRole('button', { name: '计算并加入明细' }).click()
  await page
    .locator('.result-panel')
    .getByText('820*2060', { exact: true })
    .waitFor()
  await page.getByRole('button', { name: '生成生产单和销售单' }).click()
  await page.getByRole('dialog').waitFor()
}
async function main() {
  app = await electron.launch({ args: [root], cwd: root, env })
  let page = await app.firstWindow()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  await openOrder(page)
  let name = page.getByPlaceholder('输入或选择经销商名称')
  let phone = page.getByPlaceholder('输入或选择电话')
  const address = page.getByPlaceholder('输入或选择经销商地址')
  await name.fill('芃悦居')
  await phone.fill('01234567890')
  await address.fill('永康市地址一')
  await page.getByRole('dialog').locator('input').nth(4).click()
  await historyMatches(
    page,
    (h) =>
      h.dealerName[0] === '芃悦居' &&
      h.call[0] === '01234567890' &&
      h.dealerAddress[0] === '永康市地址一',
  )
  await name.fill('')
  await name.click()
  await page
    .locator('.recent-order-option')
    .getByText('芃悦居', { exact: true })
    .click()
  assert.equal(await name.inputValue(), '芃悦居')
  await phone.click()
  await name.click()
  await page
    .getByRole('button', { name: '删除经销商名称记录：芃悦居', exact: true })
    .click()
  await historyMatches(page, (h) => h.dealerName.length === 0)
  assert.equal(await name.inputValue(), '芃悦居')
  await phone.click()
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.deepEqual(
    (await page.evaluate(() => window.tangtang.getRecentOrderInputs()))
      .dealerName,
    [],
  )
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '取消', exact: true })
    .click()
  await app.close()
  app = null
  app = await electron.launch({ args: [root], cwd: root, env })
  page = await app.firstWindow()
  await page.locator('.calculator-content .input-panel h2').waitFor()
  await openOrder(page)
  phone = page.getByPlaceholder('输入或选择电话')
  await phone.click()
  await page
    .locator('.recent-order-option')
    .getByText('01234567890', { exact: true })
    .waitFor()
  await phone.press('ArrowDown')
  await phone.press('Enter')
  assert.equal(await phone.inputValue(), '01234567890')
  assert.deepEqual(
    (await page.evaluate(() => window.tangtang.getRecentOrderInputs()))
      .dealerName,
    [],
  )
  await page.screenshot({ path: 'test-results/recent-inputs.png' })
  await app.close()
  app = null
  console.log(
    'recent-inputs-ui: empty dimensions, reset, blur history, selection, delete-without-readding, restart and keyboard selection passed',
  )
}
main().catch(async (error) => {
  console.error(error)
  await app?.close().catch(() => {})
  process.exitCode = 1
})
