<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { cell, type Column } from './fields'
const props = withDefaults(
  defineProps<{
    rows: any[]
    columns: Column[]
    height?: number
    fill?: boolean
    offset?: number
    action?: string
  }>(),
  { height: 320, offset: 0 },
)
defineEmits<{ action: [index: number] }>()
const scroll = ref(0),
  rowHeight = 52,
  viewport = ref<HTMLElement>()
const measuredHeight = ref(props.height)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => { measuredHeight.value = viewport.value?.clientHeight || 0 })
  if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.rows,
  () => {
    scroll.value = 0
    if (viewport.value) viewport.value.scrollTop = 0
  },
)
const start = computed(() =>
  Math.max(0, Math.floor(scroll.value / rowHeight) - 3),
)
const visible = computed(() =>
  props.rows.slice(
    start.value,
    start.value + Math.ceil((props.fill ? measuredHeight.value : props.height) / rowHeight) + 7,
  ),
)
const grid = computed(
  () =>
    `52px ${props.columns.map((c) => `${c.width || 85}px`).join(' ')} ${props.action ? '70px' : ''}`,
)
const width = computed(
  () =>
    52 +
    props.columns.reduce((n, c) => n + (c.width || 85), 0) +
    (props.action ? 70 : 0),
)
</script>
<template>
  <div
    ref="viewport"
    class="virtual-table"
    role="table"
    :aria-rowcount="rows.length"
    :style="fill ? { flex: 1, minHeight: 0 } : { height: height + 'px' }"
    @scroll="scroll = ($event.target as HTMLElement).scrollTop"
  >
    <div
      class="vt-head"
      role="row"
      :style="{ gridTemplateColumns: grid, minWidth: width + 'px' }"
    >
      <span>序号</span
      ><span v-for="c in columns" :key="c.key">{{ c.label }}</span
      ><span v-if="action" class="vt-action">操作</span>
    </div>
    <div
      v-if="rows.length"
      :style="{
        height: rows.length * rowHeight + 'px',
        position: 'relative',
        minWidth: width + 'px',
      }"
    >
      <div
        v-for="(row, i) in visible"
        :key="start + i"
        class="vt-row"
        role="row"
        :style="{
          gridTemplateColumns: grid,
          top: (start + i) * rowHeight + 'px',
          height: rowHeight + 'px',
        }"
      >
        <span>{{ offset + start + i + 1 }}</span
        ><span
          v-for="c in columns"
          :key="c.key"
          :title="String(cell(c, row) ?? '')"
          >{{ cell(c, row) }}</span
        ><span v-if="action" class="vt-action"
          ><el-button link type="primary" @click="$emit('action', start + i)">{{
            action
          }}</el-button></span
        >
      </div>
    </div>
    <div v-else class="empty-state">暂无明细，请先计算尺寸</div>
  </div>
</template>
