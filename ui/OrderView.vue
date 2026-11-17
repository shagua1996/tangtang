<script setup lang="ts">
import { watch } from 'vue'
import OrderDocument from './OrderDocument.vue'
import LabelDocument from './LabelDocument.vue'
const props = defineProps<{
  order: any
  rows: any[]
  editable?: boolean
  historyEditable?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  save: []
  print: [kind: string, index?: number]
  tabChange: [tab: string]
  delete: []
}>()
const tab = defineModel<'sale' | 'production' | 'label'>('tab', { default: 'sale' })
watch(
  () => props.order.orderId,
  () => {
    if (props.editable) tab.value = 'sale'
  },
)
watch(tab, (value) => emit('tabChange', value), { immediate: true })
</script>
<template>
  <div class="order-view">
    <el-tabs v-model="tab"
      ><el-tab-pane label="销售单" name="sale" /><el-tab-pane
        label="生产单"
        name="production" /><el-tab-pane
        label="标签"
        name="label"
    /></el-tabs>
    <template v-if="tab !== 'label'">
      <div class="document-scroll">
        <OrderDocument
          :order="order"
          :rows="rows"
          :kind="tab"
          :editable="(editable || historyEditable) && tab === 'sale'"
          :busy="busy"
        />
      </div>
      <div class="document-actions">
        <el-button type="primary" :disabled="busy" @click="emit('print', tab)"
          >打印</el-button
        ><el-button
          v-if="editable || (historyEditable && tab === 'sale')"
          type="primary"
          :disabled="busy"
          @click="emit('save')"
          >确认并保存</el-button
        >
        <el-button
          v-if="!editable && tab === 'sale'"
          type="primary"
          :disabled="busy"
          @click="emit('delete')"
          >删除</el-button
        >
      </div>
    </template>
    <div v-else class="document-labels">
      <div
        v-for="(item, index) in rows"
        :key="index"
        class="document-label-item"
      >
        <LabelDocument :order="order" :item="item" />
        <div class="label-actions">
          <el-button
            type="primary"
            :disabled="busy"
            @click="emit('print', 'label', index)"
            >打印</el-button
          >
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.order-view {
  background: #fff;
  color: #606266;
}
.document-scroll {
  width: 100%;
  overflow-x: auto;
}
.document-scroll :deep(.order-document) {
  min-width: 1000px;
}
.document-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  padding-top: 30px;
}
.document-actions .el-button {
  margin-left: 0;
}
.document-labels {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 20px 10px;
  padding-top: 24px;
}
.document-label-item {
  width: 240px;
  /* Keep every label available while avoiding layout/paint for offscreen cards. */
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
}
.label-actions {
  text-align: center;
  margin-top: 10px;
}
</style>
