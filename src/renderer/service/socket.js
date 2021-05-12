const { ipcRenderer, remote } = require('electron')
const Bus = require('../lib/bus').default

let requestId = 1
let requestCallback = {}
let winId = remote.getCurrentWindow().id

function sendMessage (message, callback) {
  message.id = requestId
  message.winId = winId
  if (callback) {
    requestCallback[requestId++] = { callback }
  }
  if (message.type === 'ipcMsg') {
    ipcRenderer.send('ipcMsg', message)
  }
}

function handleMessage (message, callback) {
  let context = requestCallback[message.id]
  if (context) {
    delete requestCallback[message.id]
    context.callback(message.error, message)
    return
  }
  console.log('onMessage', message)
  // switch (message.type) {

  // }
  Bus.$emit(message.type, message)
}

ipcRenderer.removeAllListeners('ipcMsg')
ipcRenderer.on('ipcMsg', (event, message) => {
  try {
    handleMessage(message)
  } catch (error) {
    console.log('Process ipcMsg message error:', error.message)
  }
})

export default sendMessage
