<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_HOLE,
  DEFAULT_SETTING,
  DEFAULT_DETAIL,
  DIRECTIONS,
  WALL_LABELS,
  calculate,
  makeOrder,
  clone,
  sumLines,
  formatMoney,
  formatDate,
} from '../domain/business'
import {
  dimensionFields,
  orderFields,
  settingFields,
  dictionaries,
  calculationColumns,
} from './fields'
import VirtualTable from './VirtualTable.vue'
import OrderView from './OrderView.vue'
import HistoryView from './HistoryView.vue'
import RecentOrderInput from './RecentOrderInput.vue'
import { supportsRecentOrderInputs } from './recent-input-capability'
const recentOrderInputsAvailable = ref(false)
const page = ref('calculate'),
  ready = ref(false),
  initializing = ref(true),
  setupError = ref(''),
  needsMigration = ref(false),
  busy = ref(false)
const settings = ref<any>(clone(DEFAULT_SETTING)),
  draft = ref<any>(clone(DEFAULT_SETTING)),
  hole = ref<any>(clone(DEFAULT_HOLE)),
  lines = ref<any[]>([]),
  current = ref<any>(null),
  dialog = ref(false),
  orderForm = ref<any>(
    Object.fromEntries(orderFields.map(([key]) => [key, ''])),
  ),
  dictionaryInput = ref<any>({}),
  history = ref<any>(null)
const historyOpened = ref(false)
let orderIndex: string | number = 1
const pageNames: any = {
  calculate: '尺寸计算',
  current: '当前订单',
  history: '历史记录',
  settings: '设置',
}
const total = computed(() => sumLines(lines.value))
const widthDiff = computed(
  () =>
    settings.value.baseForm[
      hole.value.wallType === 'single'
        ? 'singleWall'
        : hole.value.wallType === 'double'
          ? 'doubleWall'
          : 'doorWidthDiff'
    ],
)
const heightDiff = computed(
  () =>
    settings.value.baseForm[
      hole.value.wallType === 'up' ? 'upWall' : 'doorHeightDiff'
    ],
)
const error = (e: any) => ElMessage.error(e?.message || String(e))
async function init() {
  initializing.value = true
  setupError.value = ''
  try {
    const status = await window.tangtang.getStatus()
    recentOrderInputsAvailable.value =
      supportsRecentOrderInputs(window.tangtang) &&
      status.capabilities?.recentOrderInputs === true
    needsMigration.value = status.needsMigration
    if (!status.ready) {
      setupError.value = status.error || ''
      return
    }
    const saved = await window.tangtang.getSettings()
    settings.value = {
      ...clone(DEFAULT_SETTING),
      ...saved,
      baseForm: { ...clone(DEFAULT_SETTING.baseForm), ...saved?.baseForm },
    }
    for (const [key] of dictionaries)
      if (!Array.isArray(settings.value[key])) settings.value[key] = []
    draft.value = clone(settings.value)
    ready.value = true
  } catch (e: any) {
    setupError.value = e?.message || String(e)
  } finally {
    initializing.value = false
  }
}
async function setup(empty = false) {
  busy.value = true
  try {
    if (empty) await window.tangtang.initializeEmpty()
    else await window.tangtang.selectLegacyDirectory()
    await init()
  } catch (e) {
    error(e)
  } finally {
    busy.value = false
  }
}
async function run(work: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  try {
    await work()
  } catch (e) {
    error(e)
  } finally {
    busy.value = false
  }
}
function calculateNow() {
  if (
    dimensionFields.some(
      ([key]) =>
        hole.value[key] === '' ||
        hole.value[key] === null ||
        hole.value[key] === undefined,
    )
  ) {
    ElMessage.warning('请填写洞口宽、洞口高、墙厚和门厚')
    return
  }
  run(async () => {
    const record = calculate(clone(hole.value), clone(settings.value))
    await window.tangtang.saveCalculation(record)
    lines.value.unshift(record)
    ElMessage.success('已计算并加入明细')
  })
}
function reset() {
  hole.value = clone(DEFAULT_HOLE)
  lines.value = []
}
function showOrder() {
  if (!lines.value.length) {
    ElMessage.warning('请先计算订单所需的尺寸信息')
    return
  }
  run(async () => {
    const next = await window.tangtang.nextOrderNumber({
      date: formatDate(Date.now(), 'YYYYMMDD'),
      index: orderIndex,
    })
    orderIndex = next.index
    orderForm.value.no = next.no
    dialog.value = true
  })
}
function create() {
  if (!orderForm.value.no.trim()) return
  run(async () => {
    const order = makeOrder(clone(orderForm.value), clone(lines.value))
    await window.tangtang.createOrder(order)
    order.detailForm = clone(DEFAULT_DETAIL)
    current.value = order
    dialog.value = false
    page.value = 'current'
    history.value?.refresh()
    ElMessage.success('订单已创建')
  })
}
async function saveDetail() {
  await window.tangtang.saveOrderDetail({
    orderId: current.value.orderId,
    detailForm: clone(current.value.detailForm),
  })
  history.value?.refresh()
}
function save() {
  run(async () => {
    await saveDetail()
    ElMessage.success('订单已保存')
  })
}
function print(kind: string, itemIndex?: number) {
  run(async () => {
    if (kind === 'sale') await saveDetail()
    await window.tangtang.printOrder({
      orderId: current.value.orderId,
      kind,
      itemIndex,
    })
  })
}
async function persistSettings(candidate: any) {
  const snapshot = clone(candidate)
  const stored = await window.tangtang.saveSettings(snapshot)
  settings.value = clone(stored)
  draft.value = clone(stored)
  ElMessage.success('设置已保存')
}
function saveSettings() {
  run(() => persistSettings(draft.value))
}
function addDictionary(key: string) {
  const value = (dictionaryInput.value[key] || '').trim()
  if (!value) return
  if (draft.value[key].some((item: any) => item.value === value)) {
    ElMessage.warning('该选项已存在')
    return
  }
  run(async () => {
    const candidate = clone(draft.value)
    candidate[key].unshift({ value, label: value })
    await persistSettings(candidate)
    dictionaryInput.value[key] = ''
  })
}
function navigate(key: string) {
  page.value = key
  if (key === 'history') {
    if (historyOpened.value) history.value?.refresh()
    historyOpened.value = true
  }
}
onMounted(init)
</script>
<template>
  <div v-if="!ready" class="setup-shell">
    <div class="setup-card" v-loading="initializing">
      <div class="brand-mark">芃</div>
      <h1>欢迎使用芃悦居工作台</h1>
      <p>
        首次使用，请选择旧版数据所在目录，迁移订单与设置。也可以明确选择全新开始。
      </p>
      <el-alert
        v-if="setupError"
        :title="setupError"
        type="error"
        :closable="false"
      />
      <div class="actions">
        <el-button :loading="busy" @click="setup(true)">全新开始</el-button
        ><el-button type="primary" :loading="busy" @click="setup(false)"
          >选择旧数据目录</el-button
        >
      </div>
      <el-button link @click="init">重新检查</el-button>
    </div>
  </div>
  <div v-else class="desktop-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">芃</div>
        <div><b>芃悦居</b><small>木门订单工作台</small></div>
      </div>
      <div class="nav-caption">工作空间</div>
      <nav>
        <button
          :class="{ active: page === 'calculate' }"
          @click="navigate('calculate')"
        >
          <span class="nav-icon">▦</span>尺寸计算</button
        ><button
          v-if="current"
          :class="{ active: page === 'current' }"
          @click="navigate('current')"
        >
          <span class="nav-icon">▤</span>当前订单</button
        ><button
          :class="{ active: page === 'history' }"
          @click="navigate('history')"
        >
          <span class="nav-icon">◷</span>历史记录</button
        ><button
          :class="{ active: page === 'settings' }"
          @click="navigate('settings')"
        >
          <span class="nav-icon">⚙</span>设置
        </button>
      </nav>
      <div class="sidebar-footer">
        <span class="status-dot" /> 本地工作空间<small
          >专注每一扇门的细节</small
        >
      </div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <span
          >工作空间 <span class="crumb">/</span>
          <b>{{ pageNames[page] }}</b></span
        ><span class="muted">{{ formatDate(Date.now(), 'YYYY-MM-DD') }}</span>
      </header>
      <div
        class="page-content"
        :class="{ 'document-page': page === 'current', 'history-page': page === 'history', 'calculator-page': page === 'calculate' }"
      >
        <div v-if="page === 'history' || page === 'settings'" class="page-heading">
          <div>
            <h1>{{ pageNames[page] }}</h1>
            <p>
              {{
                page === 'settings'
                    ? '管理计算参数与常用选项。'
                    : page === 'history'
                      ? '查找已保存订单，查看并打印明细。'
                      : '核对订单信息，保存与打印。'
              }}
            </p>
          </div>
          <el-button
            v-if="page === 'settings'"
            type="primary"
            :loading="busy"
            @click="saveSettings"
            >保存设置</el-button
          >
        </div>
        <section v-show="page === 'calculate'" class="calculator-content">
          <div class="calculator-top">
            <div class="panel input-panel">
              <div class="section-heading">
                <h2>洞口尺寸</h2>
                <span class="unit-badge">单位 mm</span>
              </div>
              <el-form
                label-position="top"
                class="calculator-form"
                @submit.prevent="calculateNow"
                ><el-form-item
                  v-for="[key, label] in dimensionFields"
                  :key="key"
                  :label="label"
                  required
                  ><el-input
                    v-model="hole[key]"
                    type="number"
                    :placeholder="key === 'doorWidth' ? undefined : '0'"
                    ><template #suffix>mm</template></el-input
                  ></el-form-item
                ><el-form-item label="开启方向"
                  ><el-select
                    v-model="hole.openDirection"
                    placeholder="选择开启方向"
                    ><el-option
                      v-for="direction in DIRECTIONS"
                      :key="direction"
                      :label="direction"
                      :value="direction" /></el-select></el-form-item
                ><el-form-item
                  v-for="[dict, label] in dictionaries"
                  :key="dict"
                  :label="label"
                  ><el-select
                    v-model="
                      hole[
                        dict === 'typeOptions'
                          ? 'type'
                          : dict === 'colorOptions'
                            ? 'color'
                            : 'textrues'
                      ]
                    "
                    filterable
                    :placeholder="'选择' + label"
                    ><el-option
                      v-for="option in settings[dict]"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value" /></el-select></el-form-item
                ><el-form-item label="墙体"
                  ><el-select
                    v-model="hole.wallType"
                    clearable
                    placeholder="选择墙体"
                    ><el-option
                      v-for="(label, value) in WALL_LABELS"
                      :key="value"
                      :label="label"
                      :value="value" /></el-select></el-form-item
                ><el-form-item label="数量"
                  ><el-input
                    v-model="hole.number"
                    type="number" /></el-form-item
                ><el-form-item label="单位"
                  ><el-select v-model="hole.unit" placeholder="选择单位"
                    ><el-option label="套" value="套" /><el-option
                      label="米"
                      value="米" /></el-select></el-form-item
                ><el-form-item label="单价"
                  ><el-input v-model="hole.price" type="number"
                    ><template #prefix>¥</template></el-input
                  ></el-form-item
                ><el-form-item class="note-field" label="备注"
                  ><el-input
                    v-model="hole.sizeNote"
                    maxlength="30"
                    show-word-limit
                    placeholder="填写尺寸或工艺备注"
                /></el-form-item>
                <div class="calc-actions">
                  <el-button @click="reset">重置</el-button
                  ><el-button
                    type="primary"
                    :loading="busy"
                    native-type="submit"
                    >计算并加入明细</el-button
                  >
                </div></el-form
              >
            </div>
            <aside class="formula-panel">
              <h2>当前计算公式</h2>
              <p>随墙体类型与设置自动更新</p>
              <dl>
                <dt>门板尺寸</dt>
                <dd>(宽 − {{ widthDiff }}) × (高 − {{ heightDiff }})</dd>
                <dt>木方尺寸</dt>
                <dd>
                  横方 (门板宽 − {{ settings.baseForm.woodWidthDiff }}) × 4<br />竖方
                  (门板高 − {{ settings.baseForm.woodHeightDiff }}) × 2
                </dd>
                <dt>扣板</dt>
                <dd>
                  (墙厚 − {{ hole.doorWidth }}) × (门板宽 +
                  {{ settings.baseForm.koubanWidth }}) × 1<br />(墙厚 −
                  {{ hole.doorWidth }}) × (门板高 +
                  {{ settings.baseForm.koubanHeight }}) × 2
                </dd>
                <dt>铝材</dt>
                <dd>
                  (门板宽 + {{ settings.baseForm.lucaiWidth }}) / (门板高 +
                  {{ settings.baseForm.lucaiHeight }})
                </dd>
              </dl>
            </aside>
          </div>
          <div class="panel result-panel">
            <div class="section-heading">
              <div class="inline-heading">
                <h2>计算明细</h2>
                <span class="count">{{ lines.length }} 条</span>
              </div>
              <el-button
                type="primary"
                :loading="busy"
                :disabled="!lines.length"
                @click="showOrder"
                >生成生产单和销售单</el-button
              >
            </div>
            <VirtualTable
              :rows="lines"
              :columns="calculationColumns"
              fill
              action="移除"
              @action="lines.splice($event, 1)"
            />
            <div class="total-line">
              <span class="muted">当前计算结果 · 移除仅影响本次明细</span
              ><span
                >合计金额 <strong>¥ {{ formatMoney(total) }}</strong></span
              >
            </div>
          </div>
        </section>
        <section v-show="page === 'current'" v-if="current" class="panel">
          <OrderView
            :order="current"
            :rows="current.sizeList"
            :busy="busy"
            editable
            @save="save"
            @print="print"
          />
        </section>
        <HistoryView
          v-if="historyOpened"
          v-show="page === 'history'"
          ref="history"
          @deleted="current?.orderId === $event && (current = null)"
        />
        <section v-show="page === 'settings'" class="settings-page">
          <div class="panel">
            <div class="section-heading">
              <h2>尺寸计算参数</h2>
              <span class="unit-badge">单位 mm</span>
            </div>
            <el-form class="settings-grid" label-position="top" :disabled="busy"
              ><el-form-item
                v-for="[key, label] in settingFields"
                :key="key"
                :label="label"
                ><el-input v-model="draft.baseForm[key]" type="number"
                  ><template #suffix>mm</template></el-input
                ></el-form-item
              ></el-form
            >
          </div>
          <div class="dictionary-grid">
            <div v-for="[key, label] in dictionaries" :key="key" class="panel">
              <div class="section-heading">
                <h2>{{ label }}</h2>
                <span class="count">{{ draft[key].length }}</span>
              </div>
              <div class="dictionary-add">
                <el-input
                  :disabled="busy"
                  v-model="dictionaryInput[key]"
                  :placeholder="'添加' + label"
                  @keyup.enter="addDictionary(key)"
                /><el-button
                  type="primary"
                  :loading="busy"
                  @click="addDictionary(key)"
                  >添加</el-button
                >
              </div>
              <div class="dictionary-list">
                <div v-for="(option, index) in draft[key]" :key="option.value">
                  <span>{{ option.label }}</span
                  ><el-button
                    link
                    type="danger"
                    :disabled="busy"
                    @click="draft[key].splice(index, 1)"
                    >移除</el-button
                  >
                </div>
                <div v-if="!draft[key].length" class="empty-state">
                  暂无{{ label }}选项
                </div>
              </div>
              <p class="muted small">
                添加时保存全部设置；移除后请点击「保存设置」。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
    <el-dialog
      v-model="dialog"
      title="创建订单"
      width="620px"
      :close-on-click-modal="false"
      ><p class="dialog-hint">
        已包含 {{ lines.length }} 条计算明细 · 合计 ¥ {{ formatMoney(total) }}
      </p>
      <el-alert
        v-if="!recentOrderInputsAvailable"
        title="最近输入暂不可用，请保存当前订单后重启应用。仍可手动输入。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-form label-position="top" class="order-form"
        ><el-form-item
          v-for="[key, label] in orderFields"
          :key="key"
          :label="label"
          :required="key === 'no'"
          ><el-date-picker
            v-if="key === 'deliveryDate'"
            v-model="orderForm[key]"
            type="date"
            placeholder="选择日期" /><RecentOrderInput
            v-else-if="['dealerName', 'dealerAddress', 'call'].includes(key)"
            v-model.trim="orderForm[key]"
            :field="key"
            :available="recentOrderInputsAvailable"
            :label="label"
            :disabled="busy" /><el-input
            v-else
            v-model.trim="orderForm[key]"
            :maxlength="key === 'call' ? 11 : undefined"
            :type="
              key === 'orderNote' ? 'textarea' : 'text'
            " /></el-form-item></el-form
      ><template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :loading="busy"
          :disabled="!orderForm.no.trim()"
          @click="create"
          >创建订单</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
