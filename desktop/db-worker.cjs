'use strict'
const { parentPort, workerData } = require('worker_threads')
const { Repository } = require('./database.cjs')
const allowed = new Set([
  'listOrders',
  'getOrderHeader',
  'listOrderItems',
  'createOrder',
  'saveOrderDetail',
  'deleteOrder',
  'deleteOrders',
  'saveCalculation',
  'getSettings',
  'saveSettings',
  'nextOrderNumber',
  'getRecentOrderInputs',
  'rememberOrderInput',
  'deleteRecentOrderInput',
])
let repository
try {
  repository = new Repository(workerData.dbPath, {
    readonly: workerData.readonly,
  })
} catch (error) {
  parentPort.postMessage({ type: 'error', error: error.message })
  throw error
}
parentPort.on('message', ({ id, method, args }) => {
  try {
    if (method === 'close') {
      repository.close()
      parentPort.postMessage({ id, result: true })
      parentPort.close()
      return
    }
    if (!allowed.has(method)) throw new Error('不支持的数据库操作')
    const result = repository[method](...(Array.isArray(args) ? args : [args]))
    parentPort.postMessage({ id, result })
  } catch (error) {
    parentPort.postMessage({ id, error: error.message })
  }
})
parentPort.postMessage({ type: 'ready' })
