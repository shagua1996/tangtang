<template lang="pug">
  #history
    el-tabs.tabs(v-model="activeTab")
      el-tab-pane(label="订单记录", name="produ")
        .serch
          i.el-icon-search.f-fs-18.f-m-r-10
          el-input.serch-input(v-model.trim="searchText", placeholder="请输入想要搜索的内容", size="mini")
        .inner-box.f-m-t-10(v-if="orderArr.length > 0")
          .left-box
            div 共{{orderArr.length}}条
            .left.beautify-scrollbar
              template(v-for="item, index in showOrderList")
                .date.f-m-t-10.s-fc-333.f-fwb(v-if="showDate(index)")
                  i.el-icon-date
                  span {{ item.createAt | date('YYYY年MM月DD日') }}
                .item.f-csp.f-p-5.f-toe(
                  @click="showProTable(item, index)",
                  :class="{'active' : currentIndex === index}") {{ item.orderId }}-{{ item.orderForm.clientName }}
            .page
              el-pagination(
                small,
                layout="prev, pager, next",
                :hide-on-single-page="true",
                :total="orderArr.length",
                :pager-count="5",
                :current-page="currentPage",
                :page-size="limit",
                @current-change="handlePageChange"
              )
          .right.f-m-l-10(v-if="orderArr.length > 0")
            el-tabs
              el-tab-pane(label="销售单")
                .list
                  sale-order(:saleData="orderData", @on-submit="onSubmit")
              el-tab-pane(label="生产单")
                .list
                  pro-order(:productData="orderData")
        .empty.f-m-t-20.f-tac(v-else) 暂无数据
      //- el-tab-pane(label="尺寸计算记录", name="calc")
      //-   <table-result :tableData="historyData"></table-result>
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
        showOrderList: [],
        orderHistory: [],
        currentIndex: 0,
        searchText: '',
        orderData: {
          orderId: 0,
          orderForm: {},
          orderSize: {},
          detailForm: {}
        },
        currentPage: 1,
        limit: 100
      }
    },
    components: {
      'table-result': TableResult,
      'pro-order': ProductOrder,
      'sale-order': SaleOrder
    },
    methods: {
      getPageData (page) {
        const startIndex = (this.currentPage - 1) * this.limit
        const endIndex = startIndex + this.limit
        this.showOrderList = this.orderArr.slice(startIndex, endIndex)
      },
      handlePageChange (val) {
        this.currentPage = val
        this.getPageData(val)
      },
      async getCases () {
        this.historyData = await NEDB.findCase()
        this.initCases()
      },
      async initCases () {
        this.orderHistory = await NEDB.findOrder()
        this.orderArr = this.orderHistory
        this.orderData = this.orderHistory[0]
        this.currentIndex = 0
        this.getPageData(1)
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
          this.getPageData(1)
          this.currentPage = 1
        }
        let searchText = this.searchText.toUpperCase()
        this.showOrderList = _.filter(this.orderHistory, (item) => {
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
  .left-box {
    max-width: 200px;;
  }

  .left {
    width: 200px;
    min-width: 180px;
    max-width: 200px;
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
