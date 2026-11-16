const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Repository } = require('../desktop/database.cjs')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-recents-'))
const file = path.join(directory, 'test.sqlite')
let db = new Repository(file)
try {
  assert.deepEqual(db.getRecentOrderInputs(), {
    dealerName: [],
    dealerAddress: [],
    call: [],
  })
  for (let i = 0; i < 12; i++)
    db.rememberOrderInput({ field: 'dealerName', value: '经销商' + i })
  assert.deepEqual(
    db.getRecentOrderInputs().dealerName,
    Array.from({ length: 10 }, (_, i) => '经销商' + (11 - i)),
  )
  db.rememberOrderInput({ field: 'dealerName', value: ' 经销商5 ' })
  db.rememberOrderInput({ field: 'dealerName', value: '   ' })
  assert.equal(db.getRecentOrderInputs().dealerName[0], '经销商5')
  assert.equal(db.getRecentOrderInputs().dealerName.length, 10)
  db.rememberOrderInput({ field: 'dealerAddress', value: '地址一' })
  db.rememberOrderInput({ field: 'call', value: '01234567890' })
  db.createOrder({
    orderId: 'original',
    orderForm: { dealerName: '经销商5' },
    sizeList: [],
  })
  db.deleteRecentOrderInput({ field: 'dealerName', value: '经销商5' })
  assert.equal(db.getRecentOrderInputs().dealerName.includes('经销商5'), false)
  assert.equal(db.getOrderHeader('original').orderForm.dealerName, '经销商5')
  assert.throws(() =>
    db.rememberOrderInput({ field: 'clientName', value: '非法字段' }),
  )
  assert.throws(() =>
    db.deleteRecentOrderInput({ field: 'schema_version', value: '1' }),
  )
  assert.throws(() => db.rememberOrderInput({ field: 'call', value: 123 }))
  db.close()
  db = new Repository(file)
  assert.deepEqual(db.getRecentOrderInputs().dealerAddress, ['地址一'])
  assert.deepEqual(db.getRecentOrderInputs().call, ['01234567890'])
  assert.equal(db.getRecentOrderInputs().dealerName.length, 9)
  assert.equal(db.getRecentOrderInputs().dealerName.includes('经销商5'), false)
  console.log(
    'recent-inputs: limit, recency, deduplication, isolation, deletion and restart passed',
  )
} finally {
  db.close()
  fs.rmSync(directory, { recursive: true, force: true })
}
