'use strict'

import {
  app,
  BrowserWindow
} from 'electron'
import '../renderer/store'
import './listener'

if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development' ? `http://localhost:9080` : `file://${__dirname}/index.html`

function createWindow () {
  mainWindow = new BrowserWindow({
    title: '芃悦居木门尺寸计算',
    height: 863,
    width: 1366,
    minWidth: 1024,
    minHeight: 600,
    // fullscreen: true,
    useContentSize: true,
    autoHideMenuBar: true,
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadURL(winURL)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
