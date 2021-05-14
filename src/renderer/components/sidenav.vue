<template lang="pug">
  <div id="sidenav">
    .menu 
      el-menu(:default-active="$route.path", @select="handleSelect")
        el-menu-item(index='/') 计算
        el-menu-item(index='/order', v-if="showOrderPage") 当前订单
        el-menu-item(index='/history') 历史记录
        el-menu-item(index='/setting') 设置
  </div>
</template>

<script>
  import Bus from '@/lib/bus'
  export default {
    name: 'sidenav',
    data () {
      return {
        showOrderPage: false,
        nacActive: '/'
      }
    },
    methods: {
      handleSelect (key, keyPath) {
        this.$router.push({ path: key })
      }
    },
    mounted () {
      Bus.$off('showOrder')
      Bus.$on('showOrder', () => {
        this.showOrderPage = true
      })
    }
  }
</script>

<style>

</style>
