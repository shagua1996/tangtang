import { WALL_LABELS } from '../domain/business'
export const dimensionFields = [
  ['holeWidth', '洞口宽'],
  ['holeHeight', '洞口高'],
  ['wallWidth', '墙厚'],
  ['doorWidth', '门厚'],
]
export const orderFields = [
  ['no', '订单编号'],
  ['dealerName', '经销商名称'],
  ['call', '电话'],
  ['dealerAddress', '经销商地址'],
  ['clientName', '客户名称'],
  ['clientAddress', '客户地址'],
  ['deliveryDate', '交货日期'],
  ['orderNote', '订单备注'],
]
export const detailFields = [
  ['yingPay', '应付金额'],
  ['amountPay', '实付金额'],
  ['saleCompany', '销售单位'],
  ['companyAdress', '地址'],
  ['contactName', '联系人'],
  ['contact', '电话'],
  ['receiveName', '收货人'],
]
export const settingFields = [
  ['doorWidthDiff', '门板宽差量'],
  ['doorHeightDiff', '门板高差量'],
  ['woodWidthDiff', '木方宽差量'],
  ['woodHeightDiff', '木方高差量'],
  ['singleWall', '单丁墙差量'],
  ['doubleWall', '双丁墙差量'],
  ['upWall', '上丁墙差量'],
  ['koubanWidth', '扣板宽增量'],
  ['koubanHeight', '扣板高增量'],
  ['lucaiWidth', '铝材宽增量'],
  ['lucaiHeight', '铝材高增量'],
]
export const dictionaries = [
  ['typeOptions', '型号'],
  ['colorOptions', '颜色'],
  ['texturesOptions', '材质'],
]
export type Column = {
  key: string
  label: string
  width?: number
  value?: (row: any) => any
}
export const displayDirection = (row: any) =>
  row.openDirection ?? row.doorDeriction ?? ''
export const saleColumns: Column[] = [
  { key: 'type', label: '型号' },
  { key: 'color', label: '颜色' },
  { key: 'holeSize', label: '洞口尺寸', width: 145 },
  {
    key: 'wallType',
    label: '墙体',
    value: (r) => (WALL_LABELS as any)[r.wallType] || '',
  },
  { key: 'doorSize', label: '门板尺寸', width: 120 },
  { key: 'openDirection', label: '开向', value: displayDirection },
  { key: 'textrues', label: '材质' },
  { key: 'number', label: '数量', width: 60 },
  { key: 'unit', label: '单位', width: 60 },
  { key: 'price', label: '单价' },
  { key: 'singlePrice', label: '金额' },
]
export const productionColumns: Column[] = [
  { key: 'holeSize', label: '洞口尺寸', width: 145 },
  { key: 'doorSize', label: '门板尺寸', width: 120 },
  { key: 'hengFang', label: '横方', value: (r) => r.woodSize?.hengFang },
  { key: 'shufang', label: '竖方', value: (r) => r.woodSize?.shufang },
  {
    key: 'kouban',
    label: '扣板',
    width: 150,
    value: (r) => [r.coverSize?.widthOne, r.coverSize?.widthTwo].join('\n'),
  },
  {
    key: 'lucai',
    label: '铝材',
    value: (r) => [r.coverSize?.heightOne, r.coverSize?.heightTwo].join('\n'),
  },
  { key: 'openDirection', label: '开向', value: displayDirection },
  { key: 'type', label: '型号' },
  { key: 'color', label: '颜色' },
  { key: 'sizeNote', label: '备注', width: 160 },
]
export const calculationColumns: Column[] = [
  ...productionColumns.slice(0, 2),
  saleColumns[3],
  ...productionColumns.slice(2, 6),
  ...saleColumns.filter((c) =>
    [
      'openDirection',
      'type',
      'color',
      'textrues',
      'unit',
      'number',
      'price',
    ].includes(c.key),
  ),
  productionColumns[9],
]
export const cell = (column: Column, row: any) =>
  column.value ? column.value(row) : row[column.key]
