const fs = require('node:fs'),
  path = require('node:path')
const { Repository, DEFAULT_SETTING } = require('../desktop/database.cjs')
const dir = path.join(process.argv[2], 'development-db')
fs.mkdirSync(dir, { recursive: true })
const db = new Repository(path.join(dir, 'tangtang.sqlite'))
db.saveSettings({
  ...DEFAULT_SETTING,
  typeOptions: [{ value: 'F-09', label: 'F-09' }],
  colorOptions: [{ value: '原木', label: '原木' }],
  texturesOptions: [{ value: '实木', label: '实木' }],
})
for (let i = 1; i <= 202; i++)
  db.createOrder({
    orderId: '20261115' + String(i).padStart(3, '0'),
    createAt: 1794700800000,
    orderForm: {
      no: '20261115' + String(i).padStart(3, '0'),
      clientName: '客户' + i,
      clientAddress: '浙江省永康市',
      dealerName: '芃悦居',
      dealerAddress: '测试地址',
      call: '13300000000',
      deliveryDate: new Date('2026-11-20T00:00:00+08:00'),
      orderNote: '验收订单',
    },
    sizeList: [
      {
        holeSize: '900*2100*150',
        doorSize: '820*2060',
        woodSize: { hengFang: '760*4', shufang: '1930*2' },
        coverSize: {
          widthOne: '105*827*1',
          widthTwo: '105*2063*2',
          heightOne: 950,
          heightTwo: 2135,
        },
        openDirection: '外左开',
        type: 'F-09',
        color: '原木',
        textrues: '实木',
        number: 2,
        unit: '套',
        price: 1000,
        singlePrice: 2000,
        sizeNote: '测试',
      },
    ],
    totalPrice: 2000,
  })
db.close()
