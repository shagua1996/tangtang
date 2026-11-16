<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, nextTick } from 'vue'
import OrderDocument from './OrderDocument.vue'
import LabelDocument from './LabelDocument.vue'

const params = new URLSearchParams(location.search)
const kind = params.get('kind') || 'sale'
const order = shallowRef<any>(null)
const rows = shallowRef<any[]>([])
const failure = ref('')
// The restored two-level production header needs more paper space than the flat header.
const rowsPerSheet = 12
// Small independent tables bound Chromium's table layout work. All sheets
// remain in one document and are submitted as one native print job.
const sheets = computed(() => {
  const result: { offset: number; rows: any[] }[] = []
  for (let offset = 0; offset < rows.value.length; offset += rowsPerSheet) {
    result.push({
      offset,
      rows: rows.value.slice(offset, offset + rowsPerSheet),
    })
  }
  return result.length ? result : [{ offset: 0, rows: [] }]
})

onMounted(async () => {
  try {
    const id = params.get('orderId')!
    const header = await window.tangtang.getOrderHeader(id)
    const loaded: any[] = []
    if (kind === 'label') {
      const data = await window.tangtang.listOrderItems({
        orderId: id,
        offset: Number(params.get('itemIndex') || 0),
        limit: 1,
      })
      loaded.push(...data.items)
      if (!loaded.length) throw new Error('标签明细不存在')
    } else {
      while (loaded.length < header.itemCount) {
        const data = await window.tangtang.listOrderItems({
          orderId: id,
          offset: loaded.length,
          limit: 500,
        })
        if (!data.items.length) throw new Error('订单明细不完整，无法打印')
        loaded.push(...data.items)
      }
    }
    // Commit once after loading all batches, without proxying each line.
    rows.value = loaded
    order.value = header
    const style = document.createElement('style')
    style.textContent =
      kind === 'label'
        ? '@page { size: auto; margin: 2mm }'
        : '@page { size: A4 portrait; margin: 10mm }'
    document.head.appendChild(style)
    await nextTick()
    await document.fonts.ready
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    )
    await window.tangtang.printReady()
  } catch (error: any) {
    failure.value = error?.message || String(error)
    await window.tangtang.printFailed(failure.value)
  }
})
</script>
<template>
  <main class="print-document">
    <p v-if="failure">{{ failure }}</p>
    <template v-if="order">
      <LabelDocument v-if="kind === 'label'" :order="order" :item="rows[0]" />
      <template v-else
        ><section
          v-for="(sheet, index) in sheets"
          :key="sheet.offset"
          class="print-sheet"
        >
          <OrderDocument
            :order="order"
            :rows="sheet.rows"
            :kind="kind === 'production' ? 'production' : 'sale'"
            :offset="sheet.offset"
            :show-footer="index === sheets.length - 1"
          /></section
      ></template>
    </template>
  </main>
</template>
