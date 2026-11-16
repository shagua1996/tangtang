<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { supportsRecentOrderInputs } from './recent-input-capability'

const props = defineProps<{
  modelValue: string
  field: string
  label: string
  available: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const autocomplete = ref<any>()
let lastRecorded: string | null = null
let pending = Promise.resolve()
let queryRevision = 0
watch(
  () => props.modelValue,
  () => {
    lastRecorded = null
  },
)

function enqueue(action: () => Promise<void>) {
  pending = pending.then(action).catch((error) => {
    ElMessage.error(error?.message || '最近输入保存失败')
  })
  return pending
}
async function suggestions(
  query: string,
  callback: (items: { value: string }[]) => void,
) {
  const revision = ++queryRevision
  if (!props.available || !supportsRecentOrderInputs(window.tangtang)) {
    callback([])
    return
  }
  try {
    await pending
    const history = await window.tangtang.getRecentOrderInputs()
    if (revision !== queryRevision) return
    const needle = query.trim().toLocaleLowerCase()
    callback(
      history[props.field]
        .filter((value: string) => value.toLocaleLowerCase().includes(needle))
        .map((value: string) => ({ value })),
    )
  } catch (error: any) {
    if (revision === queryRevision) callback([])
    ElMessage.error(error?.message || '最近输入读取失败')
  }
}
function remember(value = props.modelValue) {
  if (!props.available || !supportsRecentOrderInputs(window.tangtang)) return
  const text = value.trim()
  if (!text || text === lastRecorded) return
  lastRecorded = text
  enqueue(async () => {
    try {
      await window.tangtang.rememberOrderInput({
        field: props.field,
        value: text,
      })
    } catch (error) {
      if (lastRecorded === text) lastRecorded = null
      throw error
    }
  })
}
function selected(item: { value: string }) {
  emit('update:modelValue', item.value)
  remember(item.value)
}
function remove(value: string) {
  if (!props.available || !supportsRecentOrderInputs(window.tangtang)) return
  ++queryRevision
  // Removing a candidate must not silently add it again when this input blurs.
  if (props.modelValue.trim() === value) lastRecorded = value
  enqueue(async () => {
    await window.tangtang.deleteRecentOrderInput({ field: props.field, value })
  }).then(() => autocomplete.value?.getData(props.modelValue))
}
</script>

<template>
  <el-autocomplete
    ref="autocomplete"
    class="recent-order-input"
    :model-value="modelValue"
    :fetch-suggestions="suggestions"
    :maxlength="field === 'call' ? 11 : undefined"
    :aria-label="label"
    :disabled="disabled"
    :debounce="150"
    :placeholder="'输入或选择' + label"
    @update:model-value="emit('update:modelValue', $event)"
    @blur="remember()"
    @select="selected"
  >
    <template #default="{ item }">
      <div class="recent-order-option">
        <span :title="item.value">{{ item.value }}</span>
        <button
          type="button"
          class="recent-order-delete"
          :aria-label="'删除' + label + '记录：' + item.value"
          @mousedown.stop.prevent
          @keydown.stop
          @click.stop.prevent="remove(item.value)"
        >
          删除
        </button>
      </div>
    </template>
  </el-autocomplete>
</template>

<style scoped>
.recent-order-input {
  width: 100%;
}
.recent-order-option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.recent-order-option > span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.recent-order-delete {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: #b44840;
  font-size: 12px;
  padding: 4px 6px;
  cursor: pointer;
}
.recent-order-delete:focus-visible {
  outline: 2px solid #245e49;
  outline-offset: 1px;
}
</style>
