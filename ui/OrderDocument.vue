<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_DETAIL, formatDate, formatMoney } from '../domain/business'
import { saleColumns, productionColumns, cell } from './fields'
const props = withDefaults(
  defineProps<{
    order: any
    rows: any[]
    kind: 'sale' | 'production'
    offset?: number
    editable?: boolean
    busy?: boolean
    showFooter?: boolean
  }>(),
  { offset: 0, showFooter: true },
)
const columns = computed(() =>
  props.kind === 'sale' ? saleColumns : productionColumns,
)
const detail = computed(() => ({ ...DEFAULT_DETAIL, ...props.order.detailForm }))
const headerGroups = [
  [{ key: 'dealerName', label: '经销商名称', aria: '经销商名称', span: 3 },
   { key: 'dealerAddress', label: '地址', aria: '经销商地址', span: 5 },
   { key: 'call', label: '电话', aria: '经销商电话', span: 4 }],
  [{ key: 'clientName', label: '客户名称', aria: '客户名称', span: 3 },
   { key: 'clientAddress', label: '地址', aria: '客户地址', span: 5 },
   { key: 'deliveryDate', label: '交货日期', aria: '交货日期', span: 4 }],
]
const deliveryDate = computed({
  get: () => formatDate(props.order.orderForm.deliveryDate),
  set: (value: string) => { props.order.orderForm.deliveryDate = value },
})
const widths = computed(() =>
  props.kind === 'sale'
    ? [6, 6, 6, 16, 7, 11, 7, 6, 7, 7, 11, 10]
    : [5, 13, 12, 9, 9, 14, 10, 8, 6, 6, 8],
)
const detailGroups = [
  [
    { key: 'yingPay', label: '应付金额', span: 6 },
    { key: 'amountPay', label: '实付金额', span: 6 },
  ],
  [
    { key: 'saleCompany', label: '销售单位', span: 4 },
    { key: 'companyAdress', label: '地址', span: 4 },
    { key: 'contactName', label: '联系人', span: 2 },
    { key: 'contact', label: '电话', span: 2 },
  ],
  [{ key: 'receiveName', label: '收货人', span: 12 }],
]
</script>
<template>
  <article class="order-document" :data-kind="kind">
    <h2 class="document-title">
      芃悦居木门{{ kind === 'sale' ? '销售单' : '生产单' }}
    </h2>
    <div class="document-heading">
      <span class="document-number">订单编号：{{ order.orderId }}</span
      ><span>日期：{{ formatDate(order.createAt) }}</span>
    </div>
    <table class="document-table">
      <colgroup>
        <col
          v-for="(width, index) in widths"
          :key="index"
          :style="{ width: width + '%' }"
        />
      </colgroup>
      <thead>
        <tr v-for="(group, index) in headerGroups" :key="index">
          <th v-for="field in group" :key="field.key" :colspan="kind === 'sale' ? 4 : field.span === 4 ? 3 : field.span">
            <label class="document-field">
              <span>{{ field.label }}：</span>
              <template v-if="editable && kind === 'sale'">
                <input v-if="field.key === 'deliveryDate'" v-model="deliveryDate" type="date" class="document-header-input" :aria-label="field.aria" :disabled="busy" />
                <input v-else v-model="order.orderForm[field.key]" class="document-header-input" :aria-label="field.aria" :disabled="busy" />
              </template>
              <span v-else class="document-header-value">{{ field.key === 'deliveryDate' ? formatDate(order.orderForm.deliveryDate) : order.orderForm[field.key] }}</span>
            </label>
          </th>
        </tr>
        <template v-if="kind === 'production'">
          <tr>
            <th colspan="11">备注：</th>
          </tr>
          <tr>
            <th rowspan="2">序号</th>
            <th rowspan="2">洞口尺寸</th>
            <th rowspan="2">门板尺寸</th>
            <th colspan="2">木方尺寸</th>
            <th colspan="2">门框</th>
            <th rowspan="2">开向</th>
            <th rowspan="2">型号</th>
            <th rowspan="2">颜色</th>
            <th rowspan="2">备注</th>
          </tr>
          <tr>
            <th>横方</th>
            <th>竖方</th>
            <th>扣板</th>
            <th>铝材</th>
          </tr>
        </template>
        <tr v-else>
          <th>序号</th>
          <th v-for="column in columns" :key="column.key">
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="offset + index"
          v-memo="[row, kind, offset]"
          class="document-line"
        >
          <td>{{ offset + index + 1 }}</td>
          <td v-for="column in columns" :key="column.key">
            <template
              v-if="
                kind === 'sale' && ['price', 'singlePrice'].includes(column.key)
              "
              >￥ </template
            >{{ cell(column, row) }}
          </td>
        </tr>
        <template v-if="kind === 'sale' && showFooter">
          <tr>
            <td colspan="8"></td>
            <td colspan="4" class="document-total">
              <span class="document-field-label">合计金额：</span>￥ {{ formatMoney(order.totalPrice) }}
            </td>
          </tr>
          <tr>
            <td colspan="12">
              <label class="document-field">
                <span>备注：</span>
                <textarea v-if="editable" v-model="order.orderForm.orderNote" class="document-note-input" aria-label="订单备注" :disabled="busy" rows="2" />
                <span v-else class="document-note-value">{{ order.orderForm.orderNote }}</span>
              </label>
            </td>
          </tr>
          <template v-for="(group, index) in detailGroups" :key="index">
            <tr>
              <td v-for="field in group" :key="field.key" :colspan="field.span">
                <label
                  class="document-field"
                >
                  <span class="document-total">{{ field.label }}：</span>
                  <input
                    v-if="editable"
                    class="document-detail-input"
                    :aria-label="field.label"
                    :disabled="busy"
                    v-model="order.detailForm[field.key]"
                  />
                  <span v-else class="document-field-value">{{
                    detail[field.key]
                  }}</span>
                </label>
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </article>
</template>
<style scoped>
.text-detail {
  font-weight: 400;
}
.order-document {
  width: 100%;
  color: #606266;
  background: white;
  font-size: 14px;
}
.document-title {
  text-align: center;
  font-size: 16px;
  font-weight: 400;
  padding: 24px 0 28px;
}
.document-heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 10px;
  font-size: 14px;
}
.document-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: white;
}
.document-table th,
.document-table td {
  border: 1px solid #dcdfe6;
  padding: 10px;
  text-align: left;
  font-size: 14px;
  line-height: 1.45;
  height: 40px;
  white-space: pre-line;
  overflow-wrap: anywhere;
  vertical-align: middle;
}
.document-table th {
  font-weight: 600;
  background: #fff;
}
.document-field-label,
.document-field > span:first-child {
  font-weight: 600;
}
.document-field {
  font-weight: 400;
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.document-field > span:first-child {
  flex-shrink: 0;
}
.document-field-value,
.document-header-value,
.document-note-value {
  font-weight: 400;
  min-width: 0;
  white-space: pre-wrap;
}
.document-detail-input,
.document-header-input,
.document-note-input {
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-weight: 400;
  color: inherit;
  width: 0;
  min-width: 0;
  flex: 1;
  padding: 0;
  border-radius: 0;
}
.document-detail-input:focus,
.document-header-input:focus,
.document-note-input:focus {
  outline: 1px solid #409eff;
  outline-offset: 3px;
}
.document-note-input {
  resize: vertical;
  min-height: 40px;
}
@media print {
  .order-document {
    color: #000;
    font-size: 14px;
  }
  .document-title {
    font-size: 16px;
    padding: 0 0 12px;
  }
  .document-heading {
    font-size: 12px;
    margin-bottom: 8px;
  }
  .document-table th,
  .document-table td {
    height: auto;
    padding: 3px 4px;
    font-size: 12px;
    line-height: 1.25;
    border-color: #888;
    white-space: pre-line;
    overflow: visible;
  }
  .document-table thead {
    display: table-header-group;
  }
  .document-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
</style>
