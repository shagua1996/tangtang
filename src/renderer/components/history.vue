<template lang="pug">
  #history
    el-tabs.tabs(v-model="activeTab")
      el-tab-pane(label="订单记录", name="produ")
        .inner-box(v-if="orderArr.length > 0")
          .left
            template(v-for="item, index in orderArr")
              .item.f-csp(@click="showProTable(item, index)", :class="{'active' : currentIndex === index}") {{ item.orderId }}-{{ item.orderForm.clientName }}
          .right
            el-tabs
              el-tab-pane(label="生产单")
                .list
                  pro-order(:productData="orderData")
              el-tab-pane(label="销售单")
                .list
                  sale-order(:saleData="orderData", @on-submit="onSubmit")
        .inner-box.f-tac.f-m-t-20(v-else) 暂无数据
      el-tab-pane(label="尺寸计算记录", name="calc")
        <table-result :tableData="historyData"></table-result>
</template>

<script>
  import NEDB from '@/lib/nedb'
  import TableResult from './table/result'
  import ProductOrder from '@/components/table/productOrder'
  import SaleOrder from '@/components/table/saleOrder'
  export default {
    name: 'history',
    data () {
      return {
        activeTab: 'produ',
        historyData: [],
        orderArr: [],
        orderHistory: {},
        currentIndex: 0,
        orderData: {
          orderId: 0,
          orderForm: {},
          orderSize: {},
          detailForm: {}
        }
      }
    },
    components: {
      'table-result': TableResult,
      'pro-order': ProductOrder,
      'sale-order': SaleOrder
    },
    methods: {
      async getCases () {
        this.historyData = await NEDB.findCase()
        this.orderArr = await NEDB.findOrder()
        this.orderArr.forEach(order => {
          this.orderHistory[order.orderForm.no] = order
        })
        this.orderData = this.orderArr[0]
        console.log('orderHistory::', this.orderHistory)
      },
      showProTable (data, index) {
        this.currentIndex = index
        this.orderData = data
      },
      showSaleTable (data) {
        this.orderData = data
      },
      async onSubmit () {
        await this.getCases()
      }
    },
    mounted () {
      this.getCases()
      console.log(this.$route.name)
    }
    // watch: {
    //   'activeTab': {
    //     async handler (val) {
    //       const orderHistory = await NEDB.findOrder()
    //       console.log('orderHistory::', orderHistory)
    //     }
    //   }
    // }
  }
</script>

<style scoped lang="scss">
  .inner-box {
    max-width: 1280px;
    min-width: 800px;
    display: flex;
    .left {
      width: 150px;
      padding: 10px;
      .item {
        margin: 5px 0;
      }
      .active {
        color: white;
        background-color: #409EFF;
      }
    }
  }
</style>
