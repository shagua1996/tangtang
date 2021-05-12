import { ipcMain, app } from 'electron'
import path from 'path'
// import fs from 'fs'

ipcMain.on('ipcMsg', async (event, arg) => {
  let appDir = path.dirname(app.getAppPath('appData'))
  switch (arg.action) {
    case 'getAppDir':
      let root = path.parse(appDir).root
      event.sender.send('ipcMsg', { type: 'getAppDir', id: arg.id, appDir, root })
      break
  }
})
