import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  displayDirection,
  cell,
  saleColumns,
  productionColumns,
  calculationColumns,
} from '../ui/fields'

test('all order presentations use legacy direction only when the current field is absent', () => {
  const examples = [
    [{ doorDeriction: '内左开' }, '内左开'],
    [{ openDirection: '外右开', doorDeriction: '内左开' }, '外右开'],
    [{ openDirection: '', doorDeriction: '内左开' }, ''],
    [{ openDirection: null, doorDeriction: '内左开' }, '内左开'],
    [{}, ''],
  ] as const
  for (const [row, expected] of examples) {
    const original = structuredClone(row)
    assert.equal(displayDirection(row), expected)
    for (const columns of [
      saleColumns,
      productionColumns,
      calculationColumns,
    ]) {
      assert.equal(
        cell(columns.find((column) => column.key === 'openDirection')!, row),
        expected,
      )
    }
    assert.deepEqual(row, original)
  }
})
