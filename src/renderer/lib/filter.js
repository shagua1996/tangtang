import Vue from 'vue'
import moment from 'moment'

Vue.filter('date', (value, format = 'YYYY-MM-DD') => {
  if (!value) return ''
  let newValue = new Date(value)
  return moment(newValue).utcOffset(8).format(format)
})

Vue.filter('formatMoney', (num) => {
  if (!num) return ''
  num = num.toString()
  let newStr = ''
  let count = 0
  if (num.indexOf('.') === -1) {
    for (let i = num.length - 1; i >= 0; i--) {
      if (count % 3 === 0 && count !== 0) {
        newStr = num.charAt(i) + ',' + newStr
      } else {
        newStr = num.charAt(i) + newStr
      }
      count++
    }
    num = newStr + '.00'
    return num
  } else {
    for (let i = num.indexOf('.') - 1; i >= 0; i--) {
      if (count % 3 === 0 && count !== 0) {
        newStr = num.charAt(i) + ',' + newStr
      } else {
        newStr = num.charAt(i) + newStr
      }
      count++
    }
    num = newStr + (num + '00').substr((num + '00').indexOf('.'), 3)
    return num
  }
})
