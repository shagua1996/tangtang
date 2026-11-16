const { contextBridge, ipcRenderer } = require('electron')
const names = [
  'listOrders',
  'getOrderHeader',
  'listOrderItems',
  'createOrder',
  'saveOrderDetail',
  'deleteOrder',
  'saveCalculation',
  'getSettings',
  'saveSettings',
  'nextOrderNumber',
  'getRecentOrderInputs',
  'rememberOrderInput',
  'deleteRecentOrderInput',
  'printOrder',
  'getStatus',
  'selectLegacyDirectory',
  'initializeEmpty',
]
const api = Object.fromEntries(
  names.map((name) => [
    name,
    async (...args) => {
      const reply = await ipcRenderer.invoke('tangtang:' + name, ...args)
      if (!reply.ok) throw new Error(reply.error)
      return reply.value
    },
  ]),
)
api.printReady = () => ipcRenderer.send('tangtang:printReady')
api.printFailed = (message) =>
  ipcRenderer.send('tangtang:printFailed', String(message))
contextBridge.exposeInMainWorld('tangtang', Object.freeze(api))
