<script setup lang="ts">
import { onMounted, ref, shallowRef, nextTick } from 'vue'
import OrderDocument from './OrderDocument.vue'
import LabelDocument from './LabelDocument.vue'

const params = new URLSearchParams(location.search)
const kind = params.get('kind') || 'sale'
const order = shallowRef<any>(null)
const rows = shallowRef<any[]>([])
const failure = ref('')
const documentElement = ref<HTMLElement>()
const sheets = shallowRef<{ offset: number; rows: any[] }[]>([])

function paginateMeasuredRows() {
  const sections = Array.from(documentElement.value!.querySelectorAll<HTMLElement>('.print-sheet'))
  const firstLine = sections[0]?.querySelector('.document-line')
  if (!firstLine) return
  // A4 portrait minus the two 10mm page margins. Measure with the same
  // 190mm width and styles used by print, including wrapped production cells.
  const headerHeight = firstLine.getBoundingClientRect().top - sections[0].getBoundingClientRect().top
  const availableHeight = 277 * 96 / 25.4 - headerHeight - 2 // collapsed-border/rounding allowance
  const heights = sections.flatMap(section =>
    Array.from(section.querySelectorAll('.document-line'), row => row.getBoundingClientRect().height),
  )
  const pages: { offset: number; rows: any[] }[] = []
  let offset = 0
  let usedHeight = 0
  for (let index = 0; index < heights.length; index++) {
    if (index > offset && usedHeight + heights[index] > availableHeight) {
      pages.push({ offset, rows: rows.value.slice(offset, index) })
      offset = index
      usedHeight = 0
    }
    usedHeight += heights[index]
  }
  pages.push({ offset, rows: rows.value.slice(offset) })
  sheets.value = pages
}

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
    if (kind !== 'label') {
      // Bounded measurement tables avoid Chromium's excessive layout cost for
      // a single 10,000-row table. These are replaced before the print request.
      const batches: { offset: number; rows: any[] }[] = []
      for (let offset = 0; offset < loaded.length; offset += 100) {
        batches.push({ offset, rows: loaded.slice(offset, offset + 100) })
      }
      sheets.value = batches.length ? batches : [{ offset: 0, rows: [] }]
    }
    const style = document.createElement('style')
    style.textContent =
      kind === 'label'
        ? '@page { size: 60mm 60mm; margin: 1mm }'
        : '@page { size: A4 portrait; margin: 10mm }'
    document.head.appendChild(style)
    await nextTick()
    await document.fonts.ready
    if (kind !== 'label') {
      paginateMeasuredRows()
      await nextTick()
    }
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
  <main ref="documentElement" class="print-document" :class="{ 'label-print-document': kind === 'label' }">
    <p v-if="failure">{{ failure }}</p>
    <template v-if="order">
      <LabelDocument v-if="kind === 'label'" :order="order" :item="rows[0]" print-layout />
      <template v-else>
        <section v-for="(sheet, index) in sheets" :key="sheet.offset" class="print-sheet">
          <OrderDocument
            :order="order"
            :rows="sheet.rows"
            :kind="kind === 'production' ? 'production' : 'sale'"
            :offset="sheet.offset"
            :show-footer="index === sheets.length - 1"
            print-layout
          />
        </section>
      </template>
    </template>
  </main>
</template>
<style scoped>
.print-document { width: 190mm; padding: 0; }
.print-document.label-print-document { width: 58mm; padding: 0; margin: 0; }
</style>
