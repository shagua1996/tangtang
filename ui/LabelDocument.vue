<script setup lang="ts">
import { computed } from 'vue'
import { displayDirection } from './fields'
const props = defineProps<{ order: any; item: any }>()
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
  <div class="document-label">
    <div v-for="[label, value] in fields" :key="label" class="document-label-row">
      <span class="document-label-name">{{ label }}：</span><strong>{{ value }}</strong>
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
  font-size: 14px;
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
@media print {
  .document-label {
    color: #000;
    font-size: 14px;
  }
}
</style>
