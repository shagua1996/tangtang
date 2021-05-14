<template lang="pug">
  <div id="product">
    .action
    .outer-box
      .sell-title
        span 订单编号：{{ productData.orderId }}
        span 日期: {{ productData.createAt | date('YYYY-MM-DD') }}
      table.production-table.f-m-t-10
        thead
          tr
            th(colspan="2") 经销商名称: {{ productData.orderForm.dealerName }}
            th(colspan="4") 地址: {{ productData.orderForm.dealerAddress }}
            th(colspan="2") 电话：{{ productData.orderForm.call }}
          tr
            th(colspan="2") 客户名称：{{ productData.orderForm.clientName }}
            th(colspan="4") 地址：{{ productData.orderForm.clientAddress }}
            th(colspan="2") 交货日期：{{ productData.orderForm.deliveryDate | date}}
          tr
            th(colspan="8") 备注:
          tr
            th(rowspan="2") 序号
            th(rowspan="2") 洞口尺寸
            th(rowspan="2") 门板尺寸
            th(colspan="2") 木方尺寸
            th(colspan="2") 门套尺寸
            th(rowspan="2") 备注
          tr
            th 横方
            th 竖方
            th 门开放向
            th 反方向
        tbody
          tr(v-for="item, index in productData.sizeList")
            td {{ index + 1 }}
            td {{ item.holeSize }}
            td {{ item.doorSize }}
            td {{ item.woodSize && item.woodSize.hengFang }}
            td {{ item.woodSize && item.woodSize.shufang }}
            td 
              span {{ item.coverSize && item.coverSize.widthOne }} <br/>
              span {{ item.coverSize && item.coverSize.widthTwo }}
            td 
              span {{ item.coverSize && item.coverSize.heightOne }} <br/>
              span {{ item.coverSize && item.coverSize.heightTwo }}
            td 
  </div>
</template>

<script>
  export default {
    name: 'product-result',
    props: {
      productData: Object
    },
    data () {
      return {
      }
    },
    methods: {
    },
    mounted () {
    }
    // watch: {
    //   tableData: {
    //     handler: 'setTableData',
    //     immediate: true,
    //     deep: true
    //   }
    // }
  }
</script>

<style scoped lang="scss">
  .action {
    height: 40px;
  }
  .outer-box {
    padding: 20px;
    border: 1px solid rgb(224, 221, 221);
    max-width: 1200px;
    .sell-title {
      display: flex;
      justify-content: space-between;
    }
  }
  table {
    border-collapse: collapse;
  }
  table, tr, th, td {
    text-align: left;
    padding: 10px;
    border: solid 1px rgb(224, 221, 221);
  }
</style>
