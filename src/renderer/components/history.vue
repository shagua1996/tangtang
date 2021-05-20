<template lang="pug">
  #history
    el-tabs.tabs(v-model="activeTab")
      el-tab-pane(label="订单记录", name="produ")
        .serch
          i.el-icon-search.f-fs-18.f-m-r-10
          el-input.serch-input(v-model.trim="searchText", placeholder="请输入想要搜索的内容", size="mini")
        .inner-box.f-m-t-10(v-if="orderArr.length > 0")
          .left.beautify-scrollbar
            template(v-for="item, index in orderArr")
              .date.f-m-t-10.s-fc-333.f-fwb(v-if="showDate(index)")
                i.el-icon-date
                span {{ item.createAt | date('YYYY年MM月DD日') }}
              .item.f-csp.f-p-5(@click="showProTable(item, index)", :class="{'active' : currentIndex === index}") {{ item.orderId }}-{{ item.orderForm.clientName }}
          .right.f-m-l-10(v-if="orderArr.length > 0")
            el-tabs
              el-tab-pane(label="销售单")
                .list
                  sale-order(:saleData="orderData", @on-submit="onSubmit")
              el-tab-pane(label="生产单")
                .list
                  pro-order(:productData="orderData")
        .empty.f-m-t-20.f-tac(v-else) 暂无数据
      el-tab-pane(label="尺寸计算记录", name="calc")
        <table-result :tableData="historyData"></table-result>
</template>

<script>
  import NEDB from '@/lib/nedb'
  import TableResult from './table/result'
  import ProductOrder from '@/components/table/productOrder'
  import SaleOrder from '@/components/table/saleOrder'
  import _ from 'lodash'
  export default {
    name: 'history',
    data () {
      return {
        activeTab: 'produ',
        historyData: [],
        orderArr: [],
        orderHistory: [],
        currentIndex: 0,
        searchText: '',
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
        this.initCases()
      },
      async initCases () {
        this.orderHistory = await NEDB.findOrder()
        this.orderArr = this.orderHistory
        this.orderData = this.orderHistory[0]
        this.currentIndex = 0
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
      },
      showDate (index) {
        if (index === 0) return true
        let lastItemDay = new Date(this.orderHistory[index - 1].createAt).getDate()
        let itemDay = new Date(this.orderHistory[index].createAt).getDate()
        let differ = new Date(this.orderHistory[index - 1].createAt).getTime() - new Date(this.orderHistory[index].createAt).getTime()
        if (lastItemDay === itemDay && differ < 3600 * 60 * 24 * 1000) return false
        return true
      },
      searchOrder () {
        if (!this.searchText) {
          this.orderArr = this.orderHistory
        }
        let searchText = this.searchText.toUpperCase()
        this.orderArr = _.filter(this.orderHistory, (item) => {
          let finValue = _(item.orderForm).values().filter(value => value.toString().toUpperCase().indexOf(searchText) > -1).value().length
          return finValue
        })
      }
    },
    mounted () {
      this.getCases()
    },
    watch: {
      searchText () {
        this.searchOrder()
      }
    }
  }
</script>

<style scoped lang="scss">
  .serch-input {
    width: 200px;
  }
  .inner-box {
    max-width: 1280px;
    min-width: 800px;
    display: flex;
    .left {
      width: 180px;
      padding: 10px;
      height: 600px;
      overflow: auto;
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
