const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const vite = spawn(
  process.execPath,
  [path.resolve('node_modules/vite/bin/vite.js')],
  { stdio: 'inherit' },
)
let electron,
  closed = false
let desktopChangeTimer
// Do not kill an active window: its unsubmitted calculation list is session-only.
const desktopWatcher = fs.watch(path.resolve('desktop'), (_event, filename) => {
  if (!filename?.endsWith('.cjs')) return
  clearTimeout(desktopChangeTimer)
  desktopChangeTimer = setTimeout(() => {
    console.warn('\n桌面功能已更新。请保存当前订单，然后关闭应用并重新运行 npm run dev，以加载最新桌面接口。\n')
  }, 500)
})
function stop() {
  if (closed) return
  closed = true
  clearTimeout(desktopChangeTimer)
  desktopWatcher.close()
  vite.kill()
  electron?.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
vite.on('exit', () => {
  stop()
})
function wait() {
  if (closed) return
  http
    .get('http://127.0.0.1:5173', (res) => {
      res.resume()
      const env = { ...process.env, TANGTANG_DEV_URL: 'http://127.0.0.1:5173' }
      delete env.ELECTRON_RUN_AS_NODE
      electron = spawn(require('electron'), ['.'], { stdio: 'inherit', env })
      electron.on('exit', stop)
    })
    .on('error', () => setTimeout(wait, 300))
}
wait()
