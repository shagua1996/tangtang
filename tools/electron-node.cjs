const { spawnSync } = require('node:child_process')
const result = spawnSync(require('electron'), process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
if (result.error) console.error(result.error)
process.exit(result.status ?? 1)
