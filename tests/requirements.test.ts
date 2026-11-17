import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculate, clone, DEFAULT_HOLE, DEFAULT_SETTING, formatDate, formatMoney, makeOrder, sumLines } from '../domain/business'

// Hand-calculated expectations from docs/requirements.md, independent of implementation.
const hole = { ...DEFAULT_HOLE, holeWidth: '900', holeHeight: '2100', wallWidth: '240', doorWidth: '45', price: '100', number: '3' }
for (const [wallType, door, horizontal, vertical, coverOne, coverTwo, aluminiumOne, aluminiumTwo] of [
  ['', '820*2060', '760*4', '1930*2', '195*827*1', '195*2063*2', 950, 2135],
  ['single', '800*2060', '740*4', '1930*2', '195*807*1', '195*2063*2', 930, 2135],
  ['double', '770*2060', '710*4', '1930*2', '195*777*1', '195*2063*2', 900, 2135],
  ['up', '820*2025', '760*4', '1895*2', '195*827*1', '195*2028*2', 950, 2100],
] as const) {
  test(`CALC-01 four wall formulas: ${wallType || 'default'}`, () => {
    const result = calculate({ ...hole, wallType }, DEFAULT_SETTING, 123)
    assert.equal(result.holeSize, '900*2100*240')
    assert.equal(result.doorSize, door)
    assert.deepEqual(result.woodSize, { hengFang: horizontal, shufang: vertical })
    assert.deepEqual(result.coverSize, { widthOne: coverOne, widthTwo: coverTwo, heightOne: aluminiumOne, heightTwo: aluminiumTwo })
    assert.equal(result.singlePrice, 300)
    assert.equal(result.createDate, 123)
  })
}
for (const [key, value, wallType, output, expected] of [
  ['doorWidthDiff', '90.5', '', 'doorSize', '809.5*2060'],
  ['doorHeightDiff', '50.5', '', 'doorSize', '820*2049.5'],
  ['woodWidthDiff', '12.5', '', 'woodSize.hengFang', '807.5*4'],
  ['woodHeightDiff', '20.5', '', 'woodSize.shufang', '2039.5*2'],
  ['singleWall', '110.5', 'single', 'doorSize', '789.5*2060'],
  ['doubleWall', '140.5', 'double', 'doorSize', '759.5*2060'],
  ['upWall', '85.5', 'up', 'doorSize', '820*2014.5'],
  ['koubanWidth', '8.5', '', 'coverSize.widthOne', '195*828.5*1'],
  ['koubanHeight', '4.5', '', 'coverSize.widthTwo', '195*2064.5*2'],
  ['lucaiWidth', '140.5', '', 'coverSize.heightOne', 960.5],
  ['lucaiHeight', '85.5', '', 'coverSize.heightTwo', 2145.5],
] as const) {
  test(`SET-01 active parameter ${key} changes its material output`, () => {
    const setting: any = clone(DEFAULT_SETTING)
    setting.baseForm[key] = value
    const result = calculate({ ...hole, wallType }, setting)
    assert.equal(output.split('.').reduce((row: any, field) => row[field], result), expected)
  })
}
test('CALC-02 quantity and unit never multiply material lengths; blank price and negatives retain legacy arithmetic', () => {
  const result = calculate({ ...hole, number: 20, unit: '米', price: '' }, DEFAULT_SETTING)
  assert.equal(result.doorSize, '820*2060')
  assert.equal(result.woodSize.hengFang, '760*4')
  assert.equal(result.singlePrice, 0)
  const negative = calculate({ ...hole, holeWidth: -1, price: -2, number: 3 }, DEFAULT_SETTING)
  assert.equal(negative.doorSize, '-81*2060')
  assert.equal(negative.singlePrice, -6)
})
test('SET-02 inactive parameters never change any calculation', () => {
  const changed = clone(DEFAULT_SETTING)
  changed.baseForm.doorCoverAdd = 999
  changed.baseForm.wallAdd = 888
  assert.deepEqual(calculate(hole, changed, 1), calculate(hole, DEFAULT_SETTING, 1))
})
test('ORDER-01 snapshots retain dates, nested values and row order after later edits', () => {
  const input = { ...hole, custom: { note: 'original' } }
  const first = calculate(input, DEFAULT_SETTING, 1)
  input.custom.note = 'changed'
  assert.equal(first.custom.note, 'original')
  const form = { no: 'SNAPSHOT', deliveryDate: new Date('2026-11-17T00:00:00Z') }
  const order = makeOrder(form, [first, { singlePrice: 0.2, doorSize: 'second' }], 123)
  form.deliveryDate.setUTCFullYear(2000)
  first.woodSize.hengFang = 'changed'
  assert.equal(order.orderForm.deliveryDate.toISOString(), '2026-11-17T00:00:00.000Z')
  assert.equal(order.sizeList[0].woodSize.hengFang, '760*4')
  assert.equal(order.sizeList[1].doorSize, 'second')
  assert.equal(order.createAt, 123)
})
test('ORDER-02 totals retain JS order, floating precision and undefined handling', () => {
  assert.equal(sumLines([]), 0)
  assert.equal(sumLines([{}, {}]), 0)
  assert.equal(sumLines([{}, { singlePrice: 2 }, {}]), 2)
  assert.equal(sumLines([{ singlePrice: 0.1 }, { singlePrice: 0.2 }]), 0.30000000000000004)
  assert.equal(sumLines([{ singlePrice: '2' }, { singlePrice: 3 }]), '23')
  assert.equal(sumLines([{ singlePrice: null }, { singlePrice: 3 }]), 3)
})
for (const [value, expected] of [
  [0, ''], ['', ''], [null, ''], [undefined, ''], ['0', '0.00'], [1.2, '1.20'],
  [1234.567, '1,234.56'], [-1234.567, '-1,234.56'], [0.009, '0.00'],
  [1e21, '1e,+21.00'], [-123, '-,123.00'],
] as const) {
  test(`FMT-01 legacy money ${String(value)}`, () => assert.equal(formatMoney(value), expected))
}
for (const [value, pattern, expected] of [
  ['2026-11-16T15:59:59Z', 'YYYY-MM-DD', '2026-11-16'],
  ['2026-11-16T16:00:00Z', 'YYYY-MM-DD', '2026-11-17'],
  ['2026-12-31T16:00:00Z', 'YYYYMMDD', '20270101'],
  ['2024-02-28T16:00:00Z', 'YYYY年MM月DD日', '2024年02月29日'],
  [0, 'YYYY-MM-DD', ''], ['', 'YYYY-MM-DD', ''], ['invalid', 'YYYY-MM-DD', 'Invalid date'],
] as const) {
  test(`FMT-02 UTC+8 ${String(value)}`, () => assert.equal(formatDate(value, pattern), expected))
}
