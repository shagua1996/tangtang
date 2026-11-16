const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-documents-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(require('electron'), ['tests/seed.cjs', data], {
  cwd: root,
  env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8',
})
assert.equal(seed.status, 0, seed.stderr)
function tableSignature() {
  const label = [...document.querySelectorAll('.document-label')].find(element => element.getBoundingClientRect().width > 0)
  if (label) return [[...label.querySelectorAll('.document-label-row')].map(row => [...row.children].map(element => ({text:element.textContent.replace(/\s+/g,''),colspan:1,rowspan:1}))) ]
  const tables = [
    ...document.querySelectorAll('.order-view table,.print-document table'),
  ].filter((t) => t.getBoundingClientRect().width > 0)
  return tables.map((table) =>
    [...table.rows].map((row) =>
      [...row.cells].map((cell) => {
        const copy = cell.cloneNode(true)
        for (const input of copy.querySelectorAll('input'))
          input.replaceWith(input.value)
        return {
          text: copy.textContent.replace(/\s+/g, ''),
          colspan: cell.colSpan,
          rowspan: cell.rowSpan,
        }
      }),
    ),
  )
}
let app
async function main() {
  try {
    app = await electron.launch({ args: [root], cwd: root, env })
    const page = await app.firstWindow()
    await page.locator('.calculator-content .input-panel h2').waitFor()
    await app.evaluate(({ app }, source) => {
      global.documentProof = []
      app.on('browser-window-created', (_, win) => {
        win.webContents.print = async (_options, callback) => {
          try {
            global.documentProof.push(
              await win.webContents.executeJavaScript('(' + source + ')()'),
            )
            callback(true)
          } catch (error) {
            callback(false, error.message)
          }
        }
      })
    }, tableSignature.toString())
    const numbers = page.locator('.calculator-form input[type=number]')
    const referenceButtonStyle = await page.locator('.calc-actions .el-button--primary').evaluate(element => {
      const css=getComputedStyle(element)
      return [css.getPropertyValue('--el-button-bg-color').trim(),css.getPropertyValue('--el-button-hover-bg-color').trim(),css.borderRadius,css.fontSize,css.height,css.padding]
    })
    await numbers.nth(0).fill('900')
    await numbers.nth(1).fill('2100')
    await numbers.nth(2).fill('150')
    await numbers.nth(4).fill('2')
    await numbers.nth(5).fill('500')
    await page.getByRole('button', { name: '计算并加入明细' }).click()
    await page.getByRole('button', { name: '生成生产单和销售单' }).click()
    const modal = page.getByRole('dialog')
    await modal.waitFor()
    await page.getByPlaceholder('输入或选择经销商名称').fill('芃悦居经销商')
    await page.getByPlaceholder('输入或选择电话').fill('13333333333')
    await page.getByPlaceholder('输入或选择经销商地址').fill('经销商地址')
    await modal.locator('input').nth(4).fill('客户姓名')
    await modal.locator('input').nth(5).fill('客户地址')
    await modal.locator('textarea').fill('订单备注')
    await modal.getByRole('button', { name: '创建订单', exact: true }).click()
    await page.locator('.document-title').waitFor()
    await page.getByLabel('应付金额', { exact: true }).fill('900')
    await page.getByLabel('实付金额', { exact: true }).fill('500')
    await page.getByLabel('收货人', { exact: true }).fill('收货人姓名')
    for (const [index, tab] of ['销售单', '生产单', '标签'].entries()) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      const expected = await page.evaluate(tableSignature)
      assert.ok(expected[0].length > 0)
      if (tab === '销售单')
        assert.equal(await page.locator('.document-table input').count(), 7)
      if (tab === '生产单')
        assert.equal(
          await page.locator('.document-table th[rowspan="2"]').count(),
          7,
        )
      if (tab === '标签') {
        assert.equal(await page.locator('table.document-label,.document-label table').count(), 0)
        assert.equal(await page.locator('.document-label-row').count(), 8)
      }
      const buttonStyles = await page.evaluate(() => {
        const styles = element => {
          const css = getComputedStyle(element)
          return [css.getPropertyValue('--el-button-bg-color').trim(),css.getPropertyValue('--el-button-hover-bg-color').trim(),css.borderRadius,css.fontSize,css.height,css.padding]
        }
        return [...document.querySelectorAll('.order-view .el-button--primary')].filter(element=>element.getBoundingClientRect().width>0).map(styles)
      })
      for(const style of buttonStyles) assert.deepEqual(style,referenceButtonStyle,'Document buttons must match calculator buttons')
      await page.screenshot({
        animations: 'disabled',
        path: path.join(root, 'test-results', 'document-' + index + '.png'),
      })
      await page.getByRole('button', { name: '打印', exact: true }).click()
      let proof = []
      for (let retry = 0; retry < 100; retry++) {
        proof = await app.evaluate(() => global.documentProof)
        if (proof.length > index) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      assert.deepEqual(
        proof[index],
        expected,
        tab +
          ' page and print must contain identical cell text and merged cells',
      )
    }
    console.log(
      'documents: sales, production and label page/print cell contents and merged cells match; seven in-table input fields retained',
    )
  } finally {
    await app?.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
