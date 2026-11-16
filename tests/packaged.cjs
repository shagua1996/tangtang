const { _electron: electron } = require('playwright'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-package-'))
const env = { ...process.env, TANGTANG_DATA_DIR: data }
delete env.ELECTRON_RUN_AS_NODE
delete env.TANGTANG_DEV_URL
const seed = spawnSync(
  require('electron'),
  [path.join(__dirname, 'seed.cjs'), data],
  { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' },
)
assert.equal(seed.status, 0, seed.stderr)
fs.renameSync(path.join(data, 'development-db'), path.join(data, 'db'))
let app
async function run() {
  try {
    app = await electron.launch({
      executablePath: path.join(root, 'release/win-unpacked/PengYueJuPlus.exe'),
      args: [],
      env,
      timeout: 30000,
    })
    const page = await app.firstWindow()
    await page.locator('.calculator-content .input-panel h2').waitFor()
    const status = await page.evaluate(() => window.tangtang.getStatus())
    assert.equal(status.ready, true)
    assert.equal(status.capabilities.recentOrderInputs, true)
    await page.evaluate(() => window.tangtang.rememberOrderInput({ field: 'call', value: '01234567890' }))
    assert.deepEqual((await page.evaluate(() => window.tangtang.getRecentOrderInputs())).call, ['01234567890'])
    await page.evaluate(() => window.tangtang.deleteRecentOrderInput({ field: 'call', value: '01234567890' }))
    assert.deepEqual((await page.evaluate(() => window.tangtang.getRecentOrderInputs())).call, [])
    const data = await page.evaluate(() =>
      window.tangtang.listOrders({ page: 3 }),
    )
    assert.equal(data.total, 202)
    assert.equal(data.items.length, 2)
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true)
    console.log(
      'packaged: ASAR workers, native SQLite, preload and pagination passed',
    )
  } finally {
    await app?.close()
  }
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
