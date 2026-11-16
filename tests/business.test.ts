import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {
  calculate,
  DEFAULT_HOLE,
  DEFAULT_SETTING,
  formatMoney,
  sumLines,
  makeOrder,
} from '../domain/business'

const script = fs
  .readFileSync(
    new URL('../src/renderer/components/LandingPage.vue', import.meta.url),
    'utf8',
  )
  .split('<script>')[1]
  .split('</script>')[0]
  .replace(/^\s*import .*$/gm, '')
  .replace('export default', 'module.exports =')
const box: any = {
  module: { exports: {} },
  defaultSetting: {},
  wallTypeMap: {},
  NEDB: { addCase: async () => {} },
  _: { cloneDeep: structuredClone },
}
vm.runInNewContext(script, box)
const legacy = box.module.exports
function original(hole: any, settings: any) {
  const ctx = legacy.data()
  ctx.baseForm = settings
  Object.assign(ctx.holeData, hole)
  ctx.doorWidthDiff = legacy.computed.doorWidthDiff.call(ctx)
  ctx.doorHeightDiff = legacy.computed.doorHeightDiff.call(ctx)
  ctx.$refs = { holeData: { validate: (fn: any) => fn(true) } }
  legacy.methods.submit.call(ctx, 'holeData')
  const result = ctx.getResultArr[0]
  delete result.createDate
  return JSON.parse(JSON.stringify(result))
}
for (const wallType of ['', 'single', 'double', 'up']) {
  for (const dimensions of [
    ['900', '2100', '150', '45', '1000', '2'],
    ['0', '0', '0', '45', '', '1'],
    ['900.25', '2100.5', '150.2', '45.1', '0.1', '3'],
    ['-1', '20', '10', '45', '-2', '0'],
  ]) {
    test(`legacy formula equivalence ${wallType} ${dimensions}`, () => {
      const [holeWidth, holeHeight, wallWidth, doorWidth, price, number] =
        dimensions
      const input = {
        ...DEFAULT_HOLE,
        holeWidth,
        holeHeight,
        wallWidth,
        doorWidth,
        price,
        number,
        wallType,
      }
      const result: any = calculate(input, DEFAULT_SETTING, 123)
      delete result.createDate
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        original(input, DEFAULT_SETTING),
      )
    })
  }
}
test('custom settings are honored and inactive settings never affect calculation', () => {
  const s = structuredClone(DEFAULT_SETTING)
  s.baseForm.woodWidthDiff = 12.5
  s.baseForm.doorCoverAdd = 999
  const h = {
    ...DEFAULT_HOLE,
    holeWidth: 900,
    holeHeight: 2100,
    wallWidth: 150,
  }
  const r: any = calculate(h, s, 0)
  delete r.createDate
  assert.deepEqual(JSON.parse(JSON.stringify(r)), original(h, s))
})
test('money preserves truncation and zero blank', () => {
  assert.equal(formatMoney(0), '')
  assert.equal(formatMoney(1234.567), '1,234.56')
  assert.equal(formatMoney(12), '12.00')
  assert.equal(
    sumLines([{ singlePrice: 0.1 }, { singlePrice: 0.2 }]),
    0.1 + 0.2,
  )
})
test('order is independent snapshot and retains list order', () => {
  const lines: any[] = [
    { singlePrice: 2, doorSize: 'a' },
    { singlePrice: 3, doorSize: 'b' },
  ]
  const form: any = { no: '20261116001' }
  const order = makeOrder(form, lines, 123)
  lines[0].doorSize = 'changed'
  form.no = 'changed'
  assert.equal(order.orderId, '20261116001')
  assert.equal(order.totalPrice, 5)
  assert.equal(order.sizeList[0].doorSize, 'a')
})
