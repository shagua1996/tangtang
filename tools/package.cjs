const path = require('node:path')
const { prepareNative, run } = require('./prepare-native.cjs')

try {
  const mode = process.argv[2]
  if (!['--dir', '--installer'].includes(mode)) throw new Error('请选择 --dir 或 --installer')
  run(process.execPath, [require.resolve('vue-tsc/bin/vue-tsc.js'), '--noEmit'])
  run(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'build'])
  const { electronDir } = prepareNative()
  // The native addon was just loaded and exercised by the target Electron runtime.
  // Avoid the legacy builder's package-manager detection (pnpm.cjs is not an exe).
  run(process.execPath, [require.resolve('electron-builder/cli.js'),
    ...(mode === '--dir' ? ['--dir', '--win', '--x64'] : ['--win', 'nsis', '--x64']),
    '--config.npmRebuild=false', '--config.electronDist=' + path.join(electronDir, 'dist')])
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
