<script setup lang="ts">
import { computed } from 'vue'
import { displayDirection } from './fields'
const props = defineProps<{ order: any; item: any; printLayout?: boolean }>()
const fields = computed(() => [
  ['客户名称', props.order.orderForm.clientName],
  ['客户地址', props.order.orderForm.clientAddress],
  ['型号', props.item.type],
  ['颜色', props.item.color],
  ['洞口尺寸', props.item.holeSize],
  ['门板尺寸', props.item.doorSize],
  ['开向', displayDirection(props.item)],
  ['备注', props.item.sizeNote],
])
</script>
<template>
  <div class="document-label" :class="{ 'label-print-layout': printLayout }">
    <div v-for="[label, value] in fields" :key="label" class="document-label-row" :data-field="label">
      <span class="document-label-name">{{ label }}{{ printLayout ? ':' : '：' }}</span><strong>{{ value }}</strong>
    </div>
  </div>
</template>
<style scoped>
.document-label {
  width: 240px;
  border: 1px solid #eee;
  padding: 6px;
  color: #606266;
  background: white;
  font-size: 16px;
}
.document-label-row {
  margin-bottom: 2px;
  line-height: 1.5;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.document-label-name {
  display: inline-block;
  width: 80px;
  font-weight: 400;
}
.document-label strong {
  font-weight: 600;
}
/* Print-only sizing; screen cards retain their existing typography. */
.document-label.label-print-layout {
  width: 58mm;
  border: 0;
  padding: 0;
  color: #000;
  font-size: 19px;
}
.label-print-layout .document-label-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 24px;
  margin-bottom: 1px;
}
.label-print-layout .document-label-row:last-child { margin-bottom: 0; }
.label-print-layout .document-label-name {
  width: 4.5em;
  flex-shrink: 0;
  white-space: nowrap;
}
.label-print-layout strong { min-width: 0; flex: 1; }
.label-print-layout [data-field="洞口尺寸"] strong,
.label-print-layout [data-field="门板尺寸"] strong {
  font-family: Arial, 'Microsoft YaHei', sans-serif;
}
@media print {
  .document-label {
    color: #000;
    font-size: 16px;
  }
}
</style>
