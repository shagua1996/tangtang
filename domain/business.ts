// Compatibility contract: src/renderer/components/LandingPage.vue:215-325.
// Do not round, clamp, convert units, or multiply material counts by order quantity.
export type RecordData = Record<string, any>
export const DEFAULT_SETTING = {
  version: 1,
  baseForm: {
    doorWidthDiff: 80,
    doorHeightDiff: 40,
    woodWidthDiff: 60,
    woodHeightDiff: 130,
    doorCoverAdd: 19,
    wallAdd: 13,
    singleWall: 100,
    doubleWall: 130,
    upWall: 75,
    koubanWidth: 7,
    koubanHeight: 3,
    lucaiWidth: 130,
    lucaiHeight: 75,
  },
  typeOptions: [] as RecordData[],
  colorOptions: [] as RecordData[],
  texturesOptions: [] as RecordData[],
  textrues: [],
}
export const DEFAULT_HOLE: RecordData = {
  holeWidth: '',
  holeHeight: '',
  wallWidth: '',
  doorWidth: 45,
  openDirection: '外左开',
  type: '',
  color: '',
  textrues: '',
  wallType: '',
  number: 1,
  unit: '套',
  price: '',
  sizeNote: '',
}
export const DEFAULT_DETAIL: RecordData = {
  amountPay: '',
  yingPay: '',
  saleCompany: '浙江永康芃悦居木门有限公司',
  companyAdress: '恩施市阳雀坝',
  contact: '13310559908',
  contactName: '丁先生',
  receiveName: '',
}
export const DIRECTIONS = ['内左开', '外左开', '内右开', '外右开']
export const WALL_LABELS: Record<string, string> = {
  single: '单丁墙',
  double: '双丁墙',
  up: '上丁墙',
}
export function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (Array.isArray(value)) return value.map(clone) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, clone(v)]),
    ) as T
  return value
}
export function calculate(
  h: RecordData,
  setting: RecordData,
  now = Date.now(),
): RecordData {
  const b = setting.baseForm
  const dw =
    h.wallType === 'single'
      ? b.singleWall
      : h.wallType === 'double'
        ? b.doubleWall
        : b.doorWidthDiff
  const dh = h.wallType === 'up' ? b.upWall : b.doorHeightDiff
  const w = h.holeWidth - dw,
    height = h.holeHeight - dh
  const cover = parseFloat(h.wallWidth) - parseFloat(h.doorWidth)
  return {
    createDate: now,
    holeSize: h.holeWidth + '*' + h.holeHeight + '*' + h.wallWidth,
    doorSize: w + '*' + height,
    woodSize: {
      hengFang: w - parseFloat(b.woodWidthDiff) + '*4',
      shufang: height - parseFloat(b.woodHeightDiff) + '*2',
    },
    coverSize: {
      widthOne: cover + '*' + (w + parseFloat(b.koubanWidth)) + '*1',
      widthTwo: cover + '*' + (height + parseFloat(b.koubanHeight)) + '*2',
      heightOne: w + parseFloat(b.lucaiWidth),
      heightTwo: height + parseFloat(b.lucaiHeight),
    },
    singlePrice: h.price * h.number,
    ...clone(h),
  }
}
export function sumLines(lines: RecordData[]): number {
  // lodash sumBy skips undefined and starts with the first defined value.
  let result: any
  for (const line of lines)
    if (line.singlePrice !== undefined)
      result =
        result === undefined ? line.singlePrice : result + line.singlePrice
  return lines.length ? (result === undefined ? 0 : result) : 0
}
export function makeOrder(
  form: RecordData,
  lines: RecordData[],
  now = Date.now(),
): RecordData {
  return {
    orderId: form.no,
    orderForm: clone(form),
    sizeList: clone(lines),
    totalPrice: sumLines(lines),
    createAt: now,
  }
}
export function formatMoney(value: any): string {
  if (!value) return ''
  const num = value.toString()
  let output = '',
    count = 0
  const end = num.indexOf('.') === -1 ? num.length : num.indexOf('.')
  for (let i = end - 1; i >= 0; i--) {
    output =
      num.charAt(i) + (count % 3 === 0 && count !== 0 ? ',' : '') + output
    count++
  }
  return (
    output +
    (num.indexOf('.') === -1
      ? '.00'
      : (num + '00').substr((num + '00').indexOf('.'), 3))
  )
}
export function formatDate(value: any, pattern = 'YYYY-MM-DD'): string {
  if (!value) return ''
  const date = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  const values: Record<string, string> = {
    YYYY: String(date.getUTCFullYear()),
    MM: String(date.getUTCMonth() + 1).padStart(2, '0'),
    DD: String(date.getUTCDate()).padStart(2, '0'),
  }
  return pattern.replace(/YYYY|MM|DD/g, (key) => values[key])
}
