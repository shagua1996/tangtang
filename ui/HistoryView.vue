<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatDate, formatMoney } from '../domain/business'
import OrderView from './OrderView.vue'
const emit = defineEmits<{ deleted: [id: string] }>()
const search = ref(''),
  summaries = ref<any[]>([]),
  total = ref(0),
  page = ref(1),
  selected = shallowRef<any>(null),
  selectedId = ref(''),
  rows = shallowRef<any[]>([]),
  busy = ref(false),
  detailBusy = ref(false),
  actionBusy = ref(false),
  listError = ref(''),
  detailError = ref('')
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
    selected.value = result.header
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
  const id = selected.value.orderId
  try {
    await ElMessageBox.confirm(
      '对应的生产单将一起删除，删除后无法恢复。',
      '删除订单',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    actionBusy.value = true
    await window.tangtang.deleteOrder(id)
    invalidate()
    emit('deleted', id)
    selected.value = null
    await load()
    ElMessage.success('订单已删除')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(errorText(e))
  } finally {
    actionBusy.value = false
  }
}
async function print(kind: string) {
  if (actionBusy.value || !selected.value) return
  actionBusy.value = true
  try {
    await window.tangtang.printOrder({ orderId: selected.value.orderId, kind })
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
        />
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
          <button
            :class="['summary-item', { selected: selectedId === item.orderId }]"
            @click="select(item.orderId)"
          >
            <span class="summary-top"
              ><b>{{ item.orderId }}</b></span
            ><span
              >{{ item.orderForm.clientName || '未填写客户'
              }}<small>{{ item.itemCount }} 条明细</small></span
            ><strong>¥ {{ formatMoney(item.totalPrice) }}</strong>
          </button>
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
          :busy="actionBusy || detailBusy || !!detailError"
          :order="selected"
          :rows="rows"
          @print="print"
          @delete="remove"
        />
      </template>
      <div v-else-if="!detailError && !detailBusy" class="empty-state">
        选择一笔订单，查看销售与生产明细
      </div>
    </section>
  </div>
</template>
