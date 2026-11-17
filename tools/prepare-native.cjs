const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`命令执行失败 (${result.status}): ${path.basename(executable)} ${args.join(' ')}`)
}

function prepareNative() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Windows x64 打包需要在 Windows x64 主机准备原生依赖')
  // Resolve real package locations; pnpm does not hoist transitive dependencies.
  const electronPackage = require.resolve('electron/package.json')
  const electronDir = path.dirname(electronPackage)
  const electronVersion = require(electronPackage).version
  const electronPath = path.join(electronDir, 'dist', 'electron.exe')
  const versionFile = path.join(electronDir, 'dist', 'version')
  if (!fs.existsSync(electronPath) || !fs.existsSync(versionFile) ||
      fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, '') !== electronVersion ||
      !fs.existsSync(path.join(electronDir, 'path.txt'))) {
    console.log('准备 Electron ' + electronVersion + ' 运行时…')
    run(process.execPath, [path.join(electronDir, 'install.js')])
  }
  if (!fs.existsSync(electronPath)) throw new Error('Electron 运行时未安装；请检查下载日志及 ELECTRON_SKIP_BINARY_DOWNLOAD 设置')
  const sqlitePackage = require.resolve('better-sqlite3/package.json')
  const sqliteRequire = createRequire(sqlitePackage)
  const sqliteEntry = sqliteRequire.resolve('better-sqlite3')
  const probe = `const DB=require(${JSON.stringify(sqliteEntry)});const db=new DB(':memory:');db.exec('CREATE TABLE probe(value INTEGER);INSERT INTO probe VALUES(1)');if(db.prepare('SELECT value FROM probe').get().value!==1)process.exit(1);db.close();if(process.versions.electron!==${JSON.stringify(electronVersion)}||process.arch!=='x64')process.exit(1);console.log('Electron '+process.versions.electron+' / ABI '+process.versions.modules+' / SQLite verified')`
  const check = () => spawnSync(electronPath, ['-e', probe], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  let result = check()
  if (result.status !== 0) {
    console.log('安装匹配 Electron 的 SQLite 原生模块…')
    run(process.execPath, [sqliteRequire.resolve('prebuild-install/bin.js'),
      '--runtime=electron', '--target=' + electronVersion, '--platform=win32', '--arch=x64'],
    { cwd: path.dirname(sqlitePackage) })
    result = check()
  }
  if (result.error || result.status !== 0)
    throw new Error('SQLite 原生模块验证失败，停止打包：\n' + (result.error?.message || result.stderr))
  console.log(result.stdout.trim())
  return { electronDir, electronVersion }
}

module.exports = { prepareNative, run }
if (require.main === module) {
  try { prepareNative() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
