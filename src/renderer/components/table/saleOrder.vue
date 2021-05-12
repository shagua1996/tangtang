<template lang="pug">
  #sale
    .action
      .delete(v-if="$route.name === 'history'")
        el-button(size="mini", type="primary", @click="removeOrder") 删除
    .outer-box
      .sell-title
        span 订单编号：{{ saleData.orderForm.no }}
        span 日期: {{ saleData.createAt | date('YYYY-MM-DD') }}
      table.production-table.f-m-t-10
        thead
          tr
            th(colspan="3") 经销商名称: {{ saleData.orderForm.dealerName }}
            th(colspan="5") 地址: {{ saleData.orderForm.dealerAddress }}
            th(colspan="3") 电话: {{ saleData.orderForm.call }}
          tr
            th(colspan="3") 客户名称：{{ saleData.orderForm.clientName }}
            th(colspan="5") 地址：{{ saleData.orderForm.clientAddress }}
            th(colspan="3") 交货日期：{{ saleData.orderForm.deliveryDate | date }}
          tr
            th 序号
            th 型号
            th 颜色
            th 洞口尺寸
            th 门扇尺寸
            th 材质
            th 数量
            th 单位
            th 单价
            th 金额
            th 备注
        tbody
          tr(v-for="item, index in saleData.sizeList")
            td {{ index + 1 }}
            td {{ item.type }}
            td {{ item.color }}
            td {{ item.holeSize}}
            td {{ item.doorSize }}
            td {{ item.textrues }}
            td {{ item.number }}
            td {{ item.unit }}
            td {{ item.price }}
            td {{ item.singlePrice }}
            td {{ item.sizeNote }}
          tr
            td(colspan="8")
            td(colspan="2") 合计金额：￥ {{ totalPrice }}
            td
          tr 
            td(colspan="11") 备注：{{ saleData.orderForm.orderNote }}
          tr
            td(colspan="5") 应付金额：
            td(colspan="6") 实付金额：{{ saleData.detailForm.amountPay }}
          tr
            td(colspan="3") 销售单位：{{ saleData.detailForm.saleCompany }}
            td(colspan="4") 地址：{{ saleData.detailForm.companyAdress }}
            td(colspan="2") 联系人：{{ saleData.detailForm.contactName }}
            td(colspan="2") 电话：{{ saleData.detailForm.contact }}
          tr
            td(colspan="11") 收货人：{{ saleData.detailForm.receiveName }}
</template>

<script>
  import _ from 'lodash'
  import NEDB from '@/lib/nedb'
  export default {
    name: 'sale-order',
    props: {
      saleData: Object
    },
    data () {
      return {
        totalPrice: 0
      }
    },
    methods: {
      initData () {
        this.totalPrice = _.sumBy(this.saleData.sizeList, 'singlePrice')
      },
      removeOrder () {
        this.$confirm('对应的生产单将一起删除，删除数据无法回复，确认删除？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(async () => {
          await NEDB.deleteOrder(this.saleData)
          this.$message.success('删除订单成功')
          this.$emit('on-submit')
        }).catch(() => {
          console.log('')
        })
      }
    },
    mounted () {
      this.initData()
    },
    watch: {
      saleData: {
        handler: 'initData',
        immediate: true,
        deep: true
      }
    }
  }
</script>

<style scoped lang="scss">
  .action {
    position: relative;
    height: 40px;
    .delete {
      padding: 10px;
      position: absolute;
      right: 10px;
    }
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
    .label {
      width: 50px;
    }
    .el-input {

    }
  }
</style>
