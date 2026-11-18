'use strict'
const Database = require('better-sqlite3')
const { randomUUID } = require('crypto')
const DEFAULT_SETTING = {
  version: 1,
  baseForm: {
    doorWidthDiff: 80,
    doorHeightDiff: 40,
    woodWidthDiff: 60,
    woodHeightDiff: 130,
    doorCoverAdd: 19,
    wallAdd: 13,
    singleWall: 100,
    doubleWall: 130,
    upWall: 75,
    koubanWidth: 7,
    koubanHeight: 3,
    lucaiWidth: 130,
    lucaiHeight: 75,
  },
  typeOptions: [],
  colorOptions: [],
  textrues: [],
  texturesOptions: [],
}
function parse(value) {
  return JSON.parse(value, (_key, item) =>
    item &&
    typeof item === 'object' &&
    Object.keys(item).length === 1 &&
    Object.hasOwnProperty.call(item, '$$date')
      ? new Date(item.$$date)
      : item,
  )
}
function json(value) {
  return JSON.stringify(value, function (key, item) {
    const original = key === '' ? value : this[key]
    return original instanceof Date ? { $$date: original.getTime() } : item
  })
}
function integer(value, fallback, max) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? Math.min(max, Number(value))
    : fallback
}
function identifier(id) {
  if (typeof id !== 'string' || !id.length) throw new Error('订单编号不能为空')
  return id
}
function object(value, name) {
  if (
    !value ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new Error(name + '必须是对象')
}
function validateSettings(setting) {
  object(setting, '设置')
  if (setting.version === undefined) throw new Error('设置缺少版本')
  if (Object.hasOwnProperty.call(setting, 'baseForm'))
    object(setting.baseForm, '计算参数')
  for (const key of ['typeOptions', 'colorOptions', 'texturesOptions'])
    if (Object.hasOwnProperty.call(setting, key)) {
      if (!Array.isArray(setting[key])) throw new Error(key + '必须是数组')
      for (const entry of setting[key]) object(entry, key + '选项')
    }
}
const RECENT_ORDER_FIELDS = ['dealerName', 'dealerAddress', 'call']
function recentInput({ field, value }) {
  if (!RECENT_ORDER_FIELDS.includes(field))
    throw new Error('不支持的最近输入字段')
  if (typeof value !== 'string') throw new Error('最近输入必须是文本')
  return { key: 'recent_order_input:' + field, value: value.trim() }
}
function customerName(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}
class Repository {
  constructor(dbPath, options = {}) {
    this.db = new Database(dbPath, {
      readonly: !!options.readonly,
      timeout: 10000,
    })
    this.db.pragma('foreign_keys = ON')
    const schemaVersion = this.db.pragma('user_version', { simple: true })
    if (schemaVersion > 2) {
      this.db.close()
      throw new Error('数据库由更高版本创建，请升级应用')
    }
    try {
      if (!options.readonly) {
        // A consistent SQLite backup includes committed WAL contents, unlike copying the main file.
        if (
          schemaVersion < 2 &&
          this.db
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE type='table' AND name='orders'",
            )
            .get()
        ) {
          const backupPath = dbPath + '.before-schema-2-' + Date.now() + '.sqlite'
          this.db.exec("VACUUM INTO '" + backupPath.replace(/'/g, "''") + "'")
        }
        this.db.pragma('journal_mode = WAL')
        this.db.pragma('synchronous = FULL')
        this.db.transaction(() => {
          this.db
            .exec(`CREATE TABLE IF NOT EXISTS orders(order_id TEXT PRIMARY KEY, header TEXT NOT NULL, summary TEXT NOT NULL, item_count INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS order_items(order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, position INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(order_id,position));
          CREATE TABLE IF NOT EXISTS order_search(order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, position INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(order_id,position));
          CREATE TABLE IF NOT EXISTS calculations(id TEXT PRIMARY KEY,data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS settings(version TEXT PRIMARY KEY,data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS customers(name TEXT PRIMARY KEY,last_used INTEGER NOT NULL,is_deleted INTEGER NOT NULL DEFAULT 0);
          CREATE INDEX IF NOT EXISTS customers_visible_recent ON customers(is_deleted,last_used DESC,name);
          CREATE TABLE IF NOT EXISTS order_customers(order_id TEXT PRIMARY KEY REFERENCES orders(order_id) ON DELETE CASCADE,customer_name TEXT NOT NULL REFERENCES customers(name));
          CREATE INDEX IF NOT EXISTS order_customers_name ON order_customers(customer_name,order_id DESC);`)
          if (schemaVersion < 2) {
            // Keyset batches keep the upgrade bounded and never read order_items.
            let after = null
            while (true) {
              const batch = after === null
                ? this.db.prepare('SELECT order_id,header FROM orders ORDER BY order_id LIMIT 500').all()
                : this.db.prepare('SELECT order_id,header FROM orders WHERE order_id>? ORDER BY order_id LIMIT 500').all(after)
              if (!batch.length) break
              for (const row of batch) {
                const header = parse(row.header)
                const timestamp = new Date(header.createAt).getTime()
                this.linkCustomer(row.order_id, customerName(header.orderForm?.clientName), false, Number.isFinite(timestamp) ? timestamp : 0)
              }
              after = batch[batch.length - 1].order_id
            }
          }
          this.db.exec("INSERT INTO metadata(key,value) VALUES('schema_version','2') ON CONFLICT(key) DO UPDATE SET value='2'; PRAGMA user_version=2;")
        })()
      }
    } catch (error) {
      this.db.close()
      throw error
    }
    this.insertOrder = this.db.transaction((order) => {
      object(order, '订单')
      const { sizeList = [], ...header } = order
      identifier(header.orderId)
      object(header.orderForm, '订单表单')
      if (!Array.isArray(sizeList)) throw new Error('订单明细必须是数组')
      for (const item of sizeList) object(item, '订单明细')
      if (Object.hasOwnProperty.call(header, 'detailForm'))
        object(header.detailForm, '订单详情')
      if (!header._id) header._id = randomUUID()
      const summary = {
        orderId: header.orderId,
        createAt: header.createAt,
        orderForm: header.orderForm,
        totalPrice: header.totalPrice,
        itemCount: sizeList.length,
      }
      this.db
        .prepare('INSERT INTO orders VALUES(?,?,?,?)')
        .run(header.orderId, json(header), json(summary), sizeList.length)
      const insert = this.db.prepare('INSERT INTO order_items VALUES(?,?,?)')
      sizeList.forEach((item, index) =>
        insert.run(header.orderId, index, json(item)),
      )
      const search = this.db.prepare('INSERT INTO order_search VALUES(?,?,?)')
      Object.values(header.orderForm).forEach((v, i) =>
        search.run(
          header.orderId,
          i,
          v == null ? '' : v.toString().toUpperCase(),
        ),
      )
      this.linkCustomer(header.orderId, customerName(header.orderForm.clientName))
      return header.orderId
    })
  }
  createOrder(order) {
    return this.insertOrder(order)
  }
  // Called only inside an order write/upgrade transaction.
  linkCustomer(orderId, name, remember = true, usedAt = Date.now()) {
    this.db.prepare('DELETE FROM order_customers WHERE order_id=?').run(orderId)
    if (!name) return
    this.db.prepare(`INSERT INTO customers(name,last_used,is_deleted) VALUES(?,?,0)
      ON CONFLICT(name) DO UPDATE SET last_used=max(customers.last_used,excluded.last_used),
      is_deleted=CASE WHEN ? THEN 0 ELSE customers.is_deleted END`).run(name, usedAt, remember ? 1 : 0)
    this.db.prepare('INSERT INTO order_customers(order_id,customer_name) VALUES(?,?)').run(orderId, name)
  }
  listCustomers({ page = 1, pageSize = 50, search = '' } = {}) {
    page = Math.max(1, integer(page, 1, 100000000))
    pageSize = Math.max(1, integer(pageSize, 50, 50))
    const term = String(search).trim()
    const where = ' WHERE is_deleted=0' + (term ? ' AND instr(name,?)>0' : '')
    const params = term ? [term] : []
    return this.db.transaction(() => ({
      items: this.db.prepare('SELECT name FROM customers' + where + ' ORDER BY last_used DESC,name LIMIT ? OFFSET ?').all(...params, pageSize, (page - 1) * pageSize),
      total: this.db.prepare('SELECT count(*) n FROM customers' + where).get(...params).n,
      page, pageSize,
    }))()
  }
  deleteCustomer({ name }) {
    if (typeof name !== 'string' || !name.trim()) throw new Error('客户名称不能为空')
    return this.db.prepare('UPDATE customers SET is_deleted=1 WHERE name=? AND is_deleted=0').run(name.trim()).changes
  }
  listOrders({ page = 1, pageSize = 100, search = '', clientName } = {}) {
    page = Math.max(1, integer(page, 1, 100000000))
    pageSize = Math.max(1, integer(pageSize, 100, 100))
    const term = String(search).toUpperCase()
    const filters = [], params = []
    if (customerName(clientName)) {
      filters.push('o.order_id IN (SELECT order_id FROM order_customers WHERE customer_name=?)')
      params.push(customerName(clientName))
    }
    if (term) {
      filters.push('EXISTS(SELECT 1 FROM order_search s WHERE s.order_id=o.order_id AND instr(s.value,?)>0)')
      params.push(term)
    }
    const where = filters.length ? ' WHERE ' + filters.join(' AND ') : ''
    // A read transaction keeps count and page on the same WAL snapshot.
    return this.db.transaction(() => ({
      items: this.db
        .prepare(
          'SELECT summary FROM orders o' +
            where +
            ' ORDER BY order_id DESC LIMIT ? OFFSET ?',
        )
        .all(...params, pageSize, (page - 1) * pageSize)
        .map((r) => parse(r.summary)),
      total: this.db
        .prepare('SELECT count(*) n FROM orders o' + where)
        .get(...params).n,
      page,
      pageSize,
    }))()
  }
  getOrderHeader(orderId) {
    const row = this.db
      .prepare('SELECT header,item_count FROM orders WHERE order_id=?')
      .get(identifier(orderId))
    return row ? { ...parse(row.header), itemCount: row.item_count } : null
  }
  listOrderItems({ orderId, offset = 0, limit = 100 }) {
    identifier(orderId)
    offset = integer(offset, 0, Number.MAX_SAFE_INTEGER)
    limit = Math.max(1, integer(limit, 100, 500))
    return this.db.transaction(() => ({
      items: this.db
        .prepare(
          'SELECT data FROM order_items WHERE order_id=? AND position>=? ORDER BY position LIMIT ?',
        )
        .all(orderId, offset, limit)
        .map((r) => parse(r.data)),
      total:
        this.db
          .prepare('SELECT item_count n FROM orders WHERE order_id=?')
          .get(orderId)?.n || 0,
    }))()
  }
  saveOrderDetail({ orderId, detailForm, orderForm }) {
    return this.db.transaction(() => {
      object(detailForm, '订单详情')
      const row = this.db
        .prepare('SELECT header,summary FROM orders WHERE order_id=?')
        .get(identifier(orderId))
      if (!row) throw new Error('订单不存在')
      const header = parse(row.header)
      const previousCustomer = customerName(header.orderForm.clientName)
      header.detailForm = detailForm
      const summary = parse(row.summary)
      if (orderForm !== undefined) {
        object(orderForm, '订单资料')
        for (const key of ['dealerName', 'dealerAddress', 'call', 'clientName', 'clientAddress', 'deliveryDate', 'orderNote']) {
          if (!Object.hasOwnProperty.call(orderForm, key)) continue
          const value = orderForm[key]
          if (value != null && typeof value !== 'string' && typeof value !== 'number' && !(key === 'deliveryDate' && value instanceof Date))
            throw new Error('订单资料字段无效：' + key)
          header.orderForm[key] = value
        }
        summary.orderForm = header.orderForm
        this.db.prepare('DELETE FROM order_search WHERE order_id=?').run(orderId)
        const insert = this.db.prepare('INSERT INTO order_search VALUES(?,?,?)')
        Object.values(header.orderForm).forEach((value, index) =>
          insert.run(orderId, index, value == null ? '' : value.toString().toUpperCase()),
        )
        const nextCustomer = customerName(header.orderForm.clientName)
        if (nextCustomer !== previousCustomer) this.linkCustomer(orderId, nextCustomer)
      }
      this.db
        .prepare('UPDATE orders SET header=?,summary=? WHERE order_id=?')
        .run(json(header), json(summary), orderId)
      return true
    })()
  }
  deleteOrder(orderId) {
    return this.db.transaction(
      () =>
        this.db
          .prepare('DELETE FROM orders WHERE order_id=?')
          .run(identifier(orderId)).changes,
    )()
  }
  deleteOrders(orderIds) {
    if (!Array.isArray(orderIds) || !orderIds.length || orderIds.length > 100)
      throw new Error('请选择 1 至 100 笔订单')
    const ids = [...new Set(Array.from(orderIds, identifier))]
    return this.db.transaction(() => {
      const remove = this.db.prepare('DELETE FROM orders WHERE order_id=?')
      return ids.reduce((count, id) => count + remove.run(id).changes, 0)
    })()
  }
  saveCalculation(record) {
    return this.db.transaction(() => {
      object(record, '计算记录')
      const data = { ...record, _id: record._id || randomUUID() }
      this.db
        .prepare('INSERT INTO calculations VALUES(?,?)')
        .run(data._id, json(data))
      return data._id
    })()
  }
  getSettings() {
    const row = this.db
      .prepare('SELECT data FROM settings ORDER BY rowid LIMIT 1')
      .get()
    return row ? parse(row.data) : parse(json(DEFAULT_SETTING))
  }
  getRecentOrderInputs() {
    const query = this.db.prepare('SELECT value FROM metadata WHERE key=?')
    return Object.fromEntries(
      RECENT_ORDER_FIELDS.map((field) => {
        const row = query.get('recent_order_input:' + field)
        return [field, row ? JSON.parse(row.value) : []]
      }),
    )
  }
  rememberOrderInput(params) {
    const { key, value } = recentInput(params)
    return this.db.transaction(() => {
      const row = this.db
        .prepare('SELECT value FROM metadata WHERE key=?')
        .get(key)
      const previous = row ? JSON.parse(row.value) : []
      if (!value) return previous
      const next = [value, ...previous.filter((item) => item !== value)].slice(
        0,
        10,
      )
      this.db
        .prepare(
          'INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        )
        .run(key, JSON.stringify(next))
      return next
    })()
  }
  deleteRecentOrderInput(params) {
    const { key, value } = recentInput(params)
    return this.db.transaction(() => {
      const row = this.db
        .prepare('SELECT value FROM metadata WHERE key=?')
        .get(key)
      const next = (row ? JSON.parse(row.value) : []).filter(
        (item) => item !== value,
      )
      this.db
        .prepare(
          'INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        )
        .run(key, JSON.stringify(next))
      return next
    })()
  }
  saveSettings(setting) {
    return this.db.transaction(() => {
      validateSettings(setting)
      const version = json(setting.version)
      const previous = this.db
        .prepare('SELECT data FROM settings WHERE version=?')
        .get(version)
      const next = { ...(previous ? parse(previous.data) : {}), ...setting }
      validateSettings(next)
      this.db
        .prepare(
          'INSERT INTO settings VALUES(?,?) ON CONFLICT(version) DO UPDATE SET data=excluded.data',
        )
        .run(version, json(next))
      return next
    })()
  }
  nextOrderNumber({ date, index = '001' }) {
    if (!/^\d{8}$/.test(date)) throw new Error('日期必须为 YYYYMMDD')
    let current = integer(index, 1, Number.MAX_SAFE_INTEGER - 1)
    const exists = this.db.prepare('SELECT 1 FROM orders WHERE order_id=?')
    while (exists.get(date + String(current).padStart(3, '0'))) current++
    const result = String(current).padStart(3, '0')
    return { no: date + result, index: result }
  }
  close() {
    this.db.close()
  }
}
module.exports = {
  Repository,
  DEFAULT_SETTING,
  encode: json,
  decode: parse,
  validateSettings,
}
