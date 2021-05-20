import util from 'util'

export const callAsync = (promise) => {
  return promise
    .then((data) => [null, data])
    .catch(err => [err, null])
}

export const call = (func, ...args) => {
  const promise = util.promisify(func).call(this, ...args)
  if (typeof promise !== 'object') {
    return Promise.reject(new Error('func should match utilpromisify'))
  }
  return this.callAsync(promise)
}
