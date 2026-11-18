const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { Worker } = require('node:worker_threads')
const { WorkerClient } = require('./worker-client.cjs')
app.setName('PengYueJuPlus')
if (process.env.TANGTANG_DATA_DIR)
  app.setPath('userData', path.resolve(process.env.TANGTANG_DATA_DIR))
const devURL = process.env.TANGTANG_DEV_URL
let mainWindow,
  writer,
  reader,
  searcher,
  dbPath,
  initializing = false,
  quitting = false
let status = { ready: false, needsMigration: true, error: '' }
let printQueue = Promise.resolve(),
  activePrint = null
let activeSearch = false,
  queuedSearch = null
const validWindows = new Set()
function trusted(event) {
  return (
    validWindows.has(event.sender.id) &&
    event.senderFrame === event.sender.mainFrame
  )
}
function protect(win) {
  const id = win.webContents.id
  validWindows.add(id)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!devURL || !url.startsWith(devURL + '/')) event.preventDefault()
  })
  win.on('closed', () => validWindows.delete(id))
}
function load(win, query = {}) {
  return devURL
    ? win.loadURL(devURL + '/?' + new URLSearchParams(query))
    : win.loadFile(path.join(__dirname, '../dist/index.html'), { query })
}
async function openDatabase() {
  writer = new WorkerClient(dbPath)
  await writer.ready
  reader = new WorkerClient(dbPath, true)
  await reader.ready
  searcher = new WorkerClient(dbPath, true)
  await searcher.ready
  status = { ready: true, needsMigration: false, error: '' }
}
function runMigration(sourceDir) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'migration-worker.cjs'), {
      workerData: { sourceDir, destinationPath: dbPath },
    })
    worker.once('message', (message) =>
      message.error
        ? reject(new Error(message.error))
        : resolve(message.result),
    )
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code) reject(new Error('数据迁移中断'))
    })
  })
}
async function setup(action) {
  if (initializing) throw new Error('数据初始化正在进行，请稍候')
  if (status.ready) return status
  initializing = true
  try {
    await action()
    await openDatabase()
    return status
  } catch (error) {
    status.error = error.message
    throw error
  } finally {
    initializing = false
  }
}
function bind(name, callback) {
  ipcMain.handle('tangtang:' + name, async (event, ...args) => {
    if (!trusted(event)) return { ok: false, error: '无效的调用来源' }
    try {
      return { ok: true, value: await callback(event, ...args) }
    } catch (error) {
      return {
        ok: false,
        error: error.message.includes('UNIQUE constraint')
          ? '订单编号或记录已存在，请检查后重试'
          : error.message,
      }
    }
  })
}
function dbReady() {
  if (!status.ready) throw new Error(status.error || '请先完成数据初始化')
}
function search(args) {
  return new Promise((resolve, reject) => {
    if (queuedSearch) queuedSearch.reject(new Error('查询已被更新'))
    queuedSearch = { args, resolve, reject }
    drainSearch()
  })
}
async function drainSearch() {
  if (activeSearch || !queuedSearch) return
  const job = queuedSearch
  queuedSearch = null
  activeSearch = true
  try {
    job.resolve(await searcher.call('listOrders', job.args))
  } catch (e) {
    job.reject(e)
  } finally {
    activeSearch = false
    drainSearch()
  }
}
function printOrder(request) {
  const task = printQueue.then(async () => {
    if (!['sale', 'production', 'label'].includes(request?.kind))
      throw new Error('无效的打印类型')
    const header = await reader.call('getOrderHeader', request.orderId)
    if (!header) throw new Error('订单不存在')
    if (
      request.kind === 'label' &&
      (!Number.isInteger(request.itemIndex) ||
        request.itemIndex < 0 ||
        request.itemIndex >= header.itemCount)
    )
      throw new Error('标签序号无效')
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 1200,
        height: 800,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      })
      protect(win)
      let finished = false
      const finish = (error) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        activePrint = null
        if (!win.isDestroyed()) win.destroy()
        error ? reject(error) : resolve(true)
      }
      const timer = setTimeout(
        () => finish(new Error('打印准备超时，请重试')),
        120000,
      )
      activePrint = { id: win.webContents.id, win, request, finish, timer }
      win.on('closed', () => finish(new Error('打印已取消')))
      win.webContents.on('render-process-gone', () =>
        finish(new Error('打印窗口异常退出')),
      )
      load(win, {
        print: '1',
        orderId: request.orderId,
        kind: request.kind,
        itemIndex: String(request.itemIndex ?? 0),
      }).catch(finish)
    })
  })
  printQueue = task.catch(() => {})
  return task
}
ipcMain.on('tangtang:printReady', (event) => {
  const job = activePrint
  if (!job || event.sender.id !== job.id || !trusted(event)) return
  clearTimeout(job.timer)
  const options = {
    silent: false,
    printBackground: true,
    landscape: false,
    margins: { marginType: 'none' },
  }
  if (job.request.kind !== 'label') options.pageSize = 'A4'
  job.win.webContents.print(options, (success, reason) =>
    job.finish(success ? null : new Error(reason || '打印已取消')),
  )
})
ipcMain.on('tangtang:printFailed', (event, message) => {
  if (activePrint?.id === event.sender.id)
    activePrint.finish(new Error(String(message)))
})
bind('getStatus', () => ({ ...status, initializing, capabilities: { recentOrderInputs: true, customers: true } }))
bind('initializeEmpty', async () =>
  setup(async () => {
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['取消', '创建空白数据库'],
      defaultId: 0,
      cancelId: 0,
      message: '确认开始全新使用？',
      detail: '如果有旧订单，请取消并选择旧 Tang 数据目录。旧文件不会被删除。',
    })
    if (answer.response !== 1) throw new Error('已取消初始化')
  }),
)
bind('selectLegacyDirectory', async () => {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: '选择包含 case.db、order.db、setting.db 的旧 Tang 文件夹',
    properties: ['openDirectory'],
  })
  if (selection.canceled) return null
  return setup(() => runMigration(selection.filePaths[0]))
})
for (const name of [
  'listCustomers',
  'getOrderHeader',
  'listOrderItems',
  'getSettings',
  'nextOrderNumber',
  'getRecentOrderInputs',
])
  bind(name, (_, ...args) => {
    dbReady()
    return reader.call(name, ...args)
  })
bind('listOrders', (_, args) => {
  dbReady()
  return args?.search ? search(args) : reader.call('listOrders', args)
})
for (const name of [
  'deleteCustomer',
  'createOrder',
  'saveOrderDetail',
  'deleteOrder',
  'deleteOrders',
  'saveCalculation',
  'saveSettings',
  'rememberOrderInput',
  'deleteRecentOrderInput',
])
  bind(name, (_, ...args) => {
    dbReady()
    return writer.call(name, ...args)
  })
bind('printOrder', (_, request) => {
  dbReady()
  return printOrder(request)
})
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(async () => {
    const directory = path.join(
      app.getPath('userData'),
      app.isPackaged ? 'db' : 'development-db',
    )
    fs.mkdirSync(directory, { recursive: true })
    dbPath = path.join(directory, 'tangtang.sqlite')
    try {
      if (fs.existsSync(dbPath)) await openDatabase()
      else {
        const legacyDir = path.resolve(
          path.dirname(app.getAppPath()),
          '../../Tang',
        )
        if (
          ['case', 'order', 'setting'].every((name) =>
            fs.existsSync(path.join(legacyDir, name + '.db')),
          )
        )
          await setup(() => runMigration(legacyDir))
      }
    } catch (error) {
      status.error = error.message
    }
    mainWindow = new BrowserWindow({
      title: '芃悦居木门尺寸计算',
      width: 1366,
      height: 863,
      minWidth: 1024,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#f4f6f5',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    protect(mainWindow)
    mainWindow.once('ready-to-show', () => {
      mainWindow.maximize()
      mainWindow.show()
    })
    await load(mainWindow)
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    if (activePrint) activePrint.finish(new Error('应用正在关闭'))
    Promise.allSettled([
      searcher?.close(),
      reader?.close(),
      writer?.close(),
    ]).finally(() => app.quit())
  })
}
