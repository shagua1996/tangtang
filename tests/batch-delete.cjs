'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Repository } = require('../desktop/database.cjs')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tangtang-batch-delete-'))
const dbPath = path.join(dir, 'test.sqlite')
let repo
try {
  repo = new Repository(dbPath)
  for (const orderId of ['A', 'B', 'KEEP'])
    repo.createOrder({ orderId, orderForm: { clientName: orderId }, sizeList: [{ number: 1 }], totalPrice: 20 })
  assert.equal(typeof repo.deleteOrders, 'function', 'Batch deletion must be available')
  for (const invalid of [null, 'A', [], ['A', ''], ['A', 2], ['A', ,], Array(101).fill('A')]) {
    assert.throws(() => repo.deleteOrders(invalid))
    assert.equal(repo.listOrders().total, 3, 'Invalid input must not delete any order')
  }
  // A real SQLite write failure after deleting A must roll back A and its children.
  repo.db.exec("CREATE TRIGGER prevent_b BEFORE DELETE ON orders WHEN OLD.order_id='B' BEGIN SELECT RAISE(ABORT, 'test delete failure'); END")
  assert.throws(() => repo.deleteOrders(['A', 'B']), /test delete failure/)
  assert.equal(repo.listOrders().total, 3)
  assert.equal(repo.listOrderItems({ orderId: 'A' }).total, 1)
  assert.equal(repo.listOrders({ search: 'A' }).total, 1)
  repo.db.exec('DROP TRIGGER prevent_b')
  assert.equal(repo.deleteOrders(['A', 'B', 'A', 'MISSING']), 2)
  assert.equal(repo.getOrderHeader('A'), null)
  assert.equal(repo.getOrderHeader('B'), null)
  assert.deepEqual(repo.listOrderItems({ orderId: 'A' }).items, [])
  assert.equal(repo.db.prepare("SELECT count(*) n FROM order_search WHERE order_id IN ('A','B')").get().n, 0)
  assert.equal(repo.getOrderHeader('KEEP').itemCount, 1)
  repo.close()
  repo = new Repository(dbPath)
  assert.deepEqual(repo.listOrders().items.map((order) => order.orderId), ['KEEP'])
  console.log('batch-delete: validation, atomic rollback, cascade, unselected orders and restart persistence passed')
} finally {
  if (repo) repo.close()
  fs.rmSync(dir, { recursive: true, force: true })
}
