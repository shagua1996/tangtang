const { Worker } = require('node:worker_threads')
const path = require('node:path')
class WorkerClient {
  constructor(dbPath, readonly = false) {
    this.id = 0
    this.pending = new Map()
    this.worker = new Worker(path.join(__dirname, 'db-worker.cjs'), {
      workerData: { dbPath, readonly },
    })
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
    this.worker.on('message', (message) => {
      if (message.type === 'ready') {
        this.readyResolve()
        return
      }
      const job = this.pending.get(message.id)
      if (!job) return
      this.pending.delete(message.id)
      message.error
        ? job.reject(new Error(message.error))
        : job.resolve(message.result)
    })
    this.worker.on('error', (error) => this.fail(error))
    this.worker.on('exit', (code) =>
      this.fail(new Error('数据库工作线程已退出：' + code)),
    )
  }
  fail(error) {
    this.error = error
    this.readyReject(error)
    for (const job of this.pending.values()) job.reject(error)
    this.pending.clear()
  }
  call(method, ...args) {
    if (this.error) return Promise.reject(this.error)
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, method, args })
    })
  }
  async close() {
    try {
      await this.call('close')
    } finally {
      await this.worker.terminate()
    }
  }
}
module.exports = { WorkerClient }
