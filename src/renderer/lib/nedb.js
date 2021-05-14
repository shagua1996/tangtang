import sendMessage from '@/service/socket'
import Datastore from 'nedb'
import { Message } from 'element-ui'
import path from 'path'
// import fs from 'fs'
let DB = {
  case: null,
  order: null,
  setting: null
}
let getAppDir = () => {
  return new Promise((resolve, reject) => {
    sendMessage({ type: 'ipcMsg', action: 'getAppDir' }, (err, result) => {
      if (!err) resolve(result.appDir)
    })
  })
}
let loadDataBase = async (name, savePath, uniqueField) => {
  DB[name] = new Datastore({ filename: path.join(savePath, `/Tang/${name}.db`) })
  await DB[name].loadDatabase()
  if (uniqueField) {
    DB[name].ensureIndex({ fieldName: uniqueField, unique: true })
  }
}
getAppDir().then(async (appPath) => {
  await loadDataBase('case', appPath)
  await loadDataBase('order', appPath, 'orderId')
  await loadDataBase('setting', appPath, 'version')
})
export default {
  addCase: (params) => {
    return new Promise((resolve, reject) => {
      DB.case.insert(params, function (err, newCase) {
        if (!err) {
          resolve(newCase)
        } else {
          Message.error('添加数据失败')
        }
      })
    })
  },
  findCase: () => {
    return new Promise((resolve, reject) => {
      DB.case.find({}).sort({ createDate: -1 }).exec(function (err, cases) {
        if (!err) {
          resolve(cases)
        } else {
          Message.error('查询数据失败')
        }
      })
    })
  },
  updateCase: (params) => {
    return new Promise((resolve, reject) => {
      DB.case.update({ createDate: params.createDate }, { $set: params }, {}, (err, numReplaced) => {
        if (!err) {
          resolve(numReplaced)
        } else {
          Message.error('更新数据失败')
        }
      })
    })
  },
  deleteCase: (params) => {
    return new Promise((resolve, reject) => {
      DB.case.remove({ createDate: params.createDate }, {}, (err, numRemoved) => {
        if (!err) {
          resolve(numRemoved)
        } else {
          Message.error('删除数据失败')
        }
      })
    })
  },
  addOrder: (params) => {
    console.log('params', params)
    return new Promise((resolve, reject) => {
      DB.order.insert(params, function (err, newOrder) {
        if (!err) {
          console.log('addorder', newOrder)
          resolve(newOrder)
        } else {
          Message.error('保存订单数据失败')
        }
      })
    })
  },
  findOrder: () => {
    return new Promise((resolve, reject) => {
      DB.order.find({}).sort({ orderId: -1 }).exec(function (err, orders) {
        if (!err) {
          resolve(orders)
        } else {
          Message.error('查询订单编号失败')
        }
      })
    })
  },
  findOrderByNo: (params) => {
    return new Promise((resolve, reject) => {
      DB.order.findOne({ orderId: params }, (err, orders) => {
        if (!err) {
          resolve(orders)
        } else {
          Message.error('查询订单编号失败', err)
        }
      })
    })
  },
  updateOrder: (params) => {
    return new Promise((resolve, reject) => {
      DB.order.update({ orderId: params.orderId }, { $set: params }, {}, (err, numReplaced) => {
        if (!err && numReplaced > 0) {
          resolve(numReplaced)
          Message.success('保存成功')
        } else {
          Message.error('更新订单失败', err)
        }
      })
    })
  },
  deleteOrder: (params) => {
    return new Promise((resolve, reject) => {
      DB.order.remove({ orderId: params.orderId }, {}, (err, numRemoved) => {
        if (!err) {
          resolve(numRemoved)
        } else {
          Message.error('删除订单失败', err)
        }
      })
    })
  },
  addSetting: (params) => {
    return new Promise((resolve, reject) => {
      DB.setting.insert(params, function (err, newSetting) {
        console.log('addsetting', newSetting)
        if (!err) {
          resolve(newSetting)
        } else {
          Message.error('保存设置失败')
        }
      })
    })
  },
  updateSetting: (params) => {
    return new Promise((resolve, reject) => {
      DB.setting.update({ version: params.version }, { $set: params }, {}, (err, numReplaced) => {
        if (!err) {
          resolve(numReplaced)
        } else {
          Message.error('更新设置失败')
        }
      })
    })
  },
  getSetting: () => {
    return new Promise((resolve, reject) => {
      if (!DB.setting) return
      DB.setting.find({}).exec(function (err, settings) {
        if (!err) {
          resolve(settings)
        } else {
          Message.error('获取设置信息失败')
        }
      })
    })
  }
}
