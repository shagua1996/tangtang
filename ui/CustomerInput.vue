<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
const props = defineProps<{ modelValue: string; available: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
let revision = 0
watch(() => props.modelValue, () => { ++revision })
onBeforeUnmount(() => { ++revision })
async function suggestions(search: string, callback: (items: { value: string }[]) => void) {
  const seq = ++revision
  if (!props.available) return callback([])
  try {
    const result = await window.tangtang.listCustomers({ search: search.trim(), pageSize: 20 })
    if (seq === revision) callback(result.items.map((item: { name: string }) => ({ value: item.name })))
  } catch (error: any) {
    if (seq !== revision) return
    callback([])
    ElMessage.error(error?.message || '客户名称读取失败，仍可手动输入')
  }
}
</script>

<template>
  <el-autocomplete
    class="customer-input"
    :model-value="modelValue"
    :fetch-suggestions="suggestions"
    :debounce="300"
    :disabled="disabled"
    aria-label="客户名称"
    placeholder="输入或选择客户名称"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
.customer-input { width: 100%; }
</style>
