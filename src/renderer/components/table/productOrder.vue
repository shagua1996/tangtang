<template lang="pug">
  <div id="product">
    .outer-box#productOrder
      .name.f-p-5.f-tac.f-fs-16 唐唐木门生产单
      .sell-title.f-m-t-20
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
            td(width="100px")
              span {{ item.sizeNote }}
    .footer.f-tar.f-p-t-10
      el-button.f-m-r-10(type="primary", v-print="printObj") 打印
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
        printObj: {
          id: 'productOrder'
        }
      }
    },
    methods: {
    },
    mounted () {
    }
  }
</script>

<style scoped lang="scss">
  .outer-box {
    padding: 20px 0;
    min-width: 800px;
    max-width: 1200px;
    .sell-title {
      display: flex;
      justify-content: space-between;
    }
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  tr, th, td {
    text-align: left;
    padding: 10px;
    border: solid 1px rgb(224, 221, 221);
  }
</style>
