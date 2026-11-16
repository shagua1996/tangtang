'use strict'
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { randomUUID, createHash } = require('crypto')
const {
  Repository,
  encode,
  decode,
  validateSettings,
} = require('./database.cjs')
function normalized(value) {
  if (value instanceof Date) return { $$date: value.getTime() }
  if (Array.isArray(value)) return value.map(normalized)
  if (value && typeof value === 'object') {
    if (
      Object.keys(value).length === 1 &&
      Object.hasOwnProperty.call(value, '$$date')
    ) {
      if (!Number.isFinite(value.$$date)) throw new Error('日期格式损坏')
      return { $$date: value.$$date }
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, normalized(value[k])]),
    )
  }
  return value
}
function canonical(value) {
  return JSON.stringify(normalized(value))
}
async function loadLog(repo, file, table) {
  const upsert = repo.db.prepare(
    `INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
  )
  const remove = repo.db.prepare(`DELETE FROM ${table} WHERE id=?`)
  const input = fs.createReadStream(file, { encoding: 'utf8' })
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let lineNumber = 0
  try {
    repo.db.exec('BEGIN')
    for await (const line of lines) {
      lineNumber++
      if (!line.trim()) continue
      let data
      try {
        data = JSON.parse(line)
      } catch (error) {
        throw new Error(
          `${path.basename(file)} 第 ${lineNumber} 行损坏：${error.message}`,
        )
      }
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error(`${path.basename(file)} 第 ${lineNumber} 行不是记录`)
      if (
        data.$$indexCreated &&
        Object.keys(data).length === 1 &&
        typeof data.$$indexCreated.fieldName === 'string'
      )
        continue
      if (
        typeof data.$$indexRemoved === 'string' &&
        Object.keys(data).length === 1
      )
        continue
      if (typeof data._id !== 'string' || !data._id)
        throw new Error(`${path.basename(file)} 第 ${lineNumber} 行缺少 _id`)
      if (data.$$deleted === true) remove.run(data._id)
      else upsert.run(data._id, canonical(data))
    }
    repo.db.exec('COMMIT')
  } catch (error) {
    if (repo.db.inTransaction) repo.db.exec('ROLLBACK')
    throw error
  } finally {
    lines.close()
    input.destroy()
  }
}
/** Copies are retained on success and failure. Original NeDB files are never opened for writing. */
async function migrate({ sourceDir, destinationPath }) {
  if (fs.existsSync(destinationPath))
    throw new Error('目标数据库已经存在，禁止覆盖')
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  const suffix = Date.now() + '-' + randomUUID()
  const backupDir = path.join(
    path.dirname(destinationPath),
    'legacy-backup-' + suffix,
  )
  const temporary = destinationPath + '.migrating-' + suffix
  fs.mkdirSync(backupDir)
  let repo
  try {
    for (const name of ['case', 'order', 'setting']) {
      const source = path.join(sourceDir, name + '.db')
      if (!fs.existsSync(source)) throw new Error(`缺少旧数据库：${name}.db`)
      fs.copyFileSync(
        source,
        path.join(backupDir, name + '.db'),
        fs.constants.COPYFILE_EXCL,
      )
    }
    repo = new Repository(temporary)
    for (const name of ['case', 'order', 'setting']) {
      repo.db.exec(
        `CREATE TABLE migration_${name}(id TEXT PRIMARY KEY,data TEXT NOT NULL)`,
      )
      await loadLog(
        repo,
        path.join(backupDir, name + '.db'),
        'migration_' + name,
      )
    }
    const counts = {}
    repo.db.transaction(() => {
      for (const name of ['case', 'order', 'setting']) {
        counts[name] = 0
        // Finish each read statement before nested repository transactions begin.
        // Iterating an active SQLite cursor prevents SAVEPOINT in better-sqlite3.
        const next = repo.db.prepare(
          `SELECT rowid,data FROM migration_${name} WHERE rowid>? ORDER BY rowid LIMIT 1`,
        )
        let position = 0,
          row
        while ((row = next.get(position))) {
          position = row.rowid
          const data = decode(row.data)
          if (name === 'order') repo.createOrder(data)
          else if (name === 'case') repo.saveCalculation(data)
          else {
            validateSettings(data)
            // Migration must reject duplicates; regular saveSettings intentionally updates.
            repo.db
              .prepare('INSERT INTO settings VALUES(?,?)')
              .run(encode(data.version), encode(data))
          }
          counts[name]++
        }
      }
    })()
    const destinationCounts = {
      case: repo.db.prepare('SELECT count(*) n FROM calculations').get().n,
      order: repo.db.prepare('SELECT count(*) n FROM orders').get().n,
      setting: repo.db.prepare('SELECT count(*) n FROM settings').get().n,
    }
    for (const name of Object.keys(counts))
      if (counts[name] !== destinationCounts[name])
        throw new Error(`迁移记录数量不一致：${name}`)
    // Compare the complete normalized record, including inactive and unknown fields.
    const hashes = {}
    for (const name of ['case', 'order', 'setting']) {
      const sourceHash = createHash('sha256'),
        destHash = createHash('sha256')
      for (const row of repo.db
        .prepare(`SELECT data FROM migration_${name} ORDER BY id`)
        .iterate()) {
        const data = decode(row.data)
        let destination
        if (name === 'order') {
          const stored = repo.db
            .prepare('SELECT header FROM orders WHERE order_id=?')
            .get(data.orderId)
          destination = decode(stored.header)
          destination.sizeList = repo.db
            .prepare(
              'SELECT data FROM order_items WHERE order_id=? ORDER BY position',
            )
            .all(data.orderId)
            .map((r) => decode(r.data))
          if (!Object.hasOwnProperty.call(data, 'sizeList'))
            delete destination.sizeList
        } else if (name === 'case')
          destination = decode(
            repo.db
              .prepare('SELECT data FROM calculations WHERE id=?')
              .get(data._id).data,
          )
        else
          destination = decode(
            repo.db
              .prepare('SELECT data FROM settings WHERE version=?')
              .get(encode(data.version)).data,
          )
        const before = canonical(data),
          after = canonical(destination)
        if (before !== after)
          throw new Error(`迁移校验失败：${name}/${data._id}`)
        sourceHash.update(before + '\n')
        destHash.update(after + '\n')
      }
      hashes[name] = {
        source: sourceHash.digest('hex'),
        destination: destHash.digest('hex'),
      }
      repo.db.exec(`DROP TABLE migration_${name}`)
    }
    if (
      repo.db.pragma('integrity_check', { simple: true }) !== 'ok' ||
      repo.db.pragma('foreign_key_check').length
    )
      throw new Error('SQLite 完整性校验失败')
    repo.db.pragma('wal_checkpoint(TRUNCATE)')
    repo.close()
    repo = null
    // Do not replace a destination created by another initialization attempt.
    if (fs.existsSync(destinationPath))
      throw new Error('目标数据库已经存在，禁止覆盖')
    fs.renameSync(temporary, destinationPath)
    return { counts, destinationCounts, hashes, backupDir, destinationPath }
  } catch (error) {
    if (repo) repo.close()
    for (const ext of ['', '-wal', '-shm'])
      fs.rmSync(temporary + ext, { force: true })
    throw error
  }
}
module.exports = { migrate, normalized, canonical }
