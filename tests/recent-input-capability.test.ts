import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supportsRecentOrderInputs } from '../ui/recent-input-capability'

test('recent inputs require the complete preload capability, not only a global bridge', () => {
  for (const bridge of [undefined, null, {}, { getStatus() {} }, { getRecentOrderInputs() {} }, { getRecentOrderInputs() {}, rememberOrderInput() {}, deleteRecentOrderInput: 'old' }]) {
    assert.equal(supportsRecentOrderInputs(bridge), false)
  }
  assert.equal(supportsRecentOrderInputs({ getRecentOrderInputs() {}, rememberOrderInput() {}, deleteRecentOrderInput() {} }), true)
})
