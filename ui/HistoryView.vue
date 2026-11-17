<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DEFAULT_DETAIL, clone, formatDate } from '../domain/business'
import OrderView from './OrderView.vue'
const emit = defineEmits<{
  deleted: [id: string]
  saved: [order: { orderId: string; detailForm: any; orderForm: any }]
}>()
const search = ref(''),
  summaries = ref<any[]>([]),
  total = ref(0),
  page = ref(1),
  selected = ref<any>(null),
  selectedId = ref(''),
  rows = shallowRef<any[]>([]),
  busy = ref(false),
  detailBusy = ref(false),
  actionBusy = ref(false),
  listError = ref(''),
  detailError = ref('')
const checkedIds = ref<string[]>([])
// Keep the chosen tab while order details unmount during loading or empty searches.
const activeTab = ref<'sale' | 'production' | 'label'>('sale')
const selectionLocked = computed(
  () => busy.value || actionBusy.value || !!listError.value,
)
const allChecked = computed(
  () => summaries.value.length > 0 && checkedIds.value.length === summaries.value.length,
)
const partlyChecked = computed(
  () => checkedIds.value.length > 0 && !allChecked.value,
)
function toggleOrder(id: string, checked: boolean) {
  if (selectionLocked.value) return
  checkedIds.value = checked
    ? [...new Set([...checkedIds.value, id])]
    : checkedIds.value.filter((value) => value !== id)
}
function togglePage(checked: boolean) {
  if (!selectionLocked.value)
    checkedIds.value = checked ? summaries.value.map((item) => item.orderId) : []
}
let request = 0,
  detailRequest = 0,
  cacheRevision = 0,
  timer: ReturnType<typeof setTimeout> | undefined
const cache = new Map<string, any>()
const errorText = (e: any) => e?.message || String(e)
async function select(id: string) {
  const seq = ++detailRequest,
    revision = cacheRevision
  selectedId.value = id
  if (selected.value?.orderId !== id) selected.value = null
  rows.value = []
  detailError.value = ''
  detailBusy.value = true
  try {
    const key = id
    let result = cache.get(key)
    if (!result) {
      const header = await window.tangtang.getOrderHeader(id)
      if (!header) throw new Error('订单不存在')
      const items: any[] = []
      while (items.length < header.itemCount) {
        if (seq !== detailRequest || revision !== cacheRevision) return
        const batch = await window.tangtang.listOrderItems({
          orderId: id,
          offset: items.length,
          limit: 500,
        })
        if (!batch.items.length) throw new Error('订单明细不完整，请重新加载')
        items.push(...batch.items)
      }
      const lines = { items }
      if (seq !== detailRequest || revision !== cacheRevision) return
      result = { header, lines }
      cache.clear()
      cache.set(key, result)
    }
    if (seq !== detailRequest) return
    selected.value = {
      ...result.header,
      orderForm: clone(result.header.orderForm),
      detailForm: { ...DEFAULT_DETAIL, ...result.header.detailForm },
    }
    rows.value = result.lines.items
  } catch (e) {
    if (seq === detailRequest) detailError.value = errorText(e)
  } finally {
    if (seq === detailRequest) detailBusy.value = false
  }
}
function changePage(value: number) {
  page.value = value
  return load()
}
async function load(): Promise<void> {
  const seq = ++request
  checkedIds.value = []
  busy.value = true
  listError.value = ''
  try {
    const data = await window.tangtang.listOrders({
      page: page.value,
      pageSize: 100,
      search: search.value.trim(),
    })
    if (seq !== request) return
    total.value = data.total
    if (page.value > 1 && !data.items.length) {
      page.value = Math.max(1, Math.ceil(data.total / 100))
      return load()
    }
    summaries.value = data.items
    const id =
      data.items.find((r: any) => r.orderId === selectedId.value)?.orderId ||
      data.items[0]?.orderId
    if (id) await select(id)
    else {
      ++detailRequest
      selectedId.value = ''
      selected.value = null
      rows.value = []
      detailBusy.value = false
    }
  } catch (e) {
    if (seq === request) listError.value = errorText(e)
  } finally {
    if (seq === request) busy.value = false
  }
}
watch(search, () => {
  ++request
  ++detailRequest
  selected.value = null
  rows.value = []
  checkedIds.value = []
  busy.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})
function invalidate() {
  ++cacheRevision
  ++detailRequest
  cache.clear()
}
async function remove() {
  if (actionBusy.value || !selected.value) return
  await removeOrders([selected.value.orderId], false)
}
async function removeChecked() {
  if (selectionLocked.value || !checkedIds.value.length) return
  await removeOrders([...checkedIds.value], true)
}
async function removeOrders(ids: string[], batch: boolean) {
  actionBusy.value = true
  try {
    await ElMessageBox.confirm(
      batch
        ? `确定删除选中的 ${ids.length} 笔订单吗？对应的生产单和标签将一起删除，删除后无法恢复。`
        : '对应的生产单和标签将一起删除，删除后无法恢复。',
      batch ? '批量删除订单' : '删除订单',
      {
        type: 'warning',
        confirmButtonText: batch ? '确认删除' : '删除',
        cancelButtonText: '取消',
        autofocus: false,
        closeOnClickModal: false,
      },
    )
    if (batch && typeof window.tangtang.deleteOrders !== 'function')
      throw new Error('批量删除暂不可用，请重启应用后重试')
    const count = batch
      ? await window.tangtang.deleteOrders(ids)
      : await window.tangtang.deleteOrder(ids[0])
    invalidate()
    ids.forEach((id) => emit('deleted', id))
    if (ids.includes(selectedId.value)) {
      selected.value = null
      rows.value = []
    }
    await load()
    ElMessage.success(batch ? `已删除 ${count} 笔订单` : '订单已删除')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(errorText(e))
  } finally {
    actionBusy.value = false
  }
}
async function saveDetail() {
  const orderId = selected.value.orderId
  const detailForm = JSON.parse(JSON.stringify(selected.value.detailForm))
  const orderForm = clone(selected.value.orderForm)
  await window.tangtang.saveOrderDetail({ orderId, detailForm, orderForm })
  cache.delete(orderId)
  summaries.value = summaries.value.map(item => item.orderId === orderId ? { ...item, orderForm: clone(orderForm) } : item)
  emit('saved', { orderId, detailForm, orderForm })
}
async function save() {
  if (actionBusy.value || detailBusy.value || !selected.value) return
  actionBusy.value = true
  try {
    await saveDetail()
    ElMessage.success('订单已保存')
  } catch (e) {
    ElMessage.error(errorText(e))
  } finally {
    actionBusy.value = false
  }
}
async function print(kind: string, itemIndex?: number) {
  if (actionBusy.value || !selected.value) return
  actionBusy.value = true
  try {
    if (kind === 'sale') await saveDetail()
    await window.tangtang.printOrder({
      orderId: selected.value.orderId,
      kind,
      itemIndex,
    })
  } catch (e) {
    ElMessage.error(errorText(e))
  } finally {
    actionBusy.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(timer)
  ++request
  invalidate()
})
defineExpose({
  refresh: () => {
    invalidate()
    return load()
  },
})
</script>
<template>
  <div class="history-layout">
    <aside class="history-list panel">
      <div class="history-tools">
        <h3>
          订单记录 <span class="count">{{ total }}</span>
        </h3>
        <el-input
          v-model="search"
          clearable
          placeholder="搜索订单、客户、电话…"
          aria-label="搜索订单"
          :disabled="actionBusy"
        />
        <div class="history-batch-tools">
          <el-checkbox
            :model-value="allChecked"
            :indeterminate="partlyChecked"
            :disabled="selectionLocked || !summaries.length"
            @change="togglePage(Boolean($event))"
            >全选本页</el-checkbox
          >
          <span class="history-selection-count" aria-live="polite"
            >已选 {{ checkedIds.length }} 笔</span
          >
          <el-button
            type="primary"
            :disabled="selectionLocked || !checkedIds.length"
            @click="removeChecked"
            >批量删除（{{ checkedIds.length }}）</el-button
          >
        </div>
      </div>
      <el-alert
        v-if="listError"
        :title="listError"
        type="error"
        :closable="false"
      /><el-button v-if="listError" link @click="load">重新加载</el-button>
      <div class="summary-list" v-loading="busy">
        <template v-for="(item, index) in summaries" :key="item.orderId">
          <div
            v-if="
              index === 0 ||
              formatDate(summaries[index - 1].createAt) !==
                formatDate(item.createAt)
            "
            class="history-date"
          >
            {{ formatDate(item.createAt) }}
          </div>
          <div class="summary-row">
            <el-checkbox
              class="summary-check"
              :model-value="checkedIds.includes(item.orderId)"
              :aria-label="`选择订单 ${item.orderId}`"
              :disabled="selectionLocked"
              @change="toggleOrder(item.orderId, Boolean($event))"
            />
            <button
              :class="['summary-item', { selected: selectedId === item.orderId }]"
              :disabled="actionBusy"
              @click="select(item.orderId)"
            >
              <span class="summary-top"
                ><b>{{ item.orderId }}</b></span
              >
              <span>{{ item.orderForm.clientName || '未填写客户' }}</span>
            </button>
          </div>
        </template>
        <div
          v-if="!summaries.length && !busy && !listError"
          class="empty-state"
        >
          {{ search.trim() ? '没有匹配的订单' : '暂无订单记录' }}
        </div>
      </div>
      <el-pagination
        small
        layout="prev,pager,next"
        :pager-count="5"
        :total="total"
        :page-size="100"
        :current-page="page"
        :disabled="busy || actionBusy"
        @current-change="changePage"
      />
    </aside>
    <section class="panel history-detail" v-loading="detailBusy">
      <el-alert
        v-if="detailError"
        :title="detailError"
        type="error"
        :closable="false"
      /><el-button v-if="detailError" link @click="select(selectedId)"
        >重新加载明细</el-button
      >
      <template v-if="selected"
        ><OrderView
          v-model:tab="activeTab"
          history-editable
          :busy="actionBusy || detailBusy || !!detailError"
          :order="selected"
          :rows="rows"
          @print="print"
          @save="save"
          @delete="remove"
        />
      </template>
      <div v-else-if="!detailError && !detailBusy" class="empty-state">
        选择一笔订单，查看销售单、生产单与标签
      </div>
    </section>
  </div>
</template>
