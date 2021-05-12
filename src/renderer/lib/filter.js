import Vue from 'vue'
import moment from 'moment'

Vue.filter('date', (value, format = 'YYYY-MM-DD') => {
  if (!value) return ''
  let newValue = new Date(value)
  return moment(newValue).utcOffset(8).format(format)
})
