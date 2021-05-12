<template lang="pug">
  <div id="order">
    el-tabs.content-width(v-model="activeName")
      el-tab-pane(label="生产单", name="first")
        product-order(:productData="newOrder")
      el-tab-pane(label="销售单", name="second")
        .outer-box
          .action
          .sell-title
              span 订单编号：{{ newOrder.orderForm.no }}
              span 日期: {{ newOrder.createAt | date('YYYY-MM-DD') }}
          table.production-table.f-m-t-10
            thead
              tr
                th(colspan="3") 经销商名称: {{ newOrder.orderForm.dealerName }}
                th(colspan="5") 地址: {{ newOrder.orderForm.dealerAddress }}
                th(colspan="3") 电话: {{ newOrder.orderForm.call }}
              tr
                th(colspan="3") 客户名称：{{ newOrder.orderForm.clientName }}
                th(colspan="5") 地址：{{ newOrder.orderForm.clientAddress }}
                th(colspan="3") 交货日期：{{ newOrder.orderForm.deliveryDate | date}}
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
              tr(v-for="item, index in newOrder.sizeList")
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
                td(colspan="11") 备注：{{ newOrder.orderForm.orderNote }}
              tr
                td(colspan="5") 应付金额：
                td(colspan="6")
                  .editInput.f-dflex
                    label.middle(for="pay") 实付金额：
                    input(v-model="amountPay", size="mini", id="pay")
              tr
                td(colspan="3")
                  .editInput.f-dflex
                    label(for="company") 销售单位：
                    input(v-model="saleCompany", size="mini", id="company")
                td(colspan="4")
                  .editInput.f-dflex
                    label.small(for="address") 地址：
                    input(v-model="companyAdress", size="mini", id="address")
                td(colspan="2")
                  .editInput.f-dflex
                    label.samll(for="contact") 联系人：
                    input(v-model="contactName", size="mini", id="contact")
                td(colspan="2")
                  .editInput.f-dflex
                    label.small(for="phone") 电话：
                    input(v-model="contact", size="mini", id="phone")
              tr
                td(colspan="11")
                  .editInput.f-dflex
                    label.middle(for="recieve") 收货人：
                    input(v-model="receiveName", size="mini", id="recieve")
        .footer.f-tar.f-p-t-10
          el-button(type="primary", @click="saveForm") 确认并保存
  </div>
</template>

<script>
  import ProductOrder from '@/components/table/productOrder'
  import SaleOrder from '@/components/table/saleOrder'
  import _ from 'lodash'
  import NEDB from '@/lib/nedb'
  export default {
    name: 'order-list',
    data () {
      return {
        totalPrice: 0,
        amountPay: '',
        saleCompany: '恩施唐唐门窗有限公司',
        companyAdress: '恩施市阳雀坝',
        contact: '13310559908',
        contactName: '丁先生',
        receiveName: '',
        newOrder: {
          orderId: 0,
          orderForm: {},
          orderSize: {}
        },
        activeName: 'first'
      }
    },
    components: {
      'product-order': ProductOrder,
      'sale-order': SaleOrder
    },
    methods: {
      initData () {
        this.newOrder = window.appData.currentOrderData
        this.totalPrice = _.sumBy(this.newOrder.sizeList, 'singlePrice')
        this.saveForm()
        console.log('this.newOrderData::', this.newOrder)
      },
      async saveForm () {
        let params = {
          amountPay: this.amountPay,
          saleCompany: this.saleCompany,
          companyAdress: this.companyAdress,
          contact: this.contact,
          contactName: this.contactName,
          receiveName: this.receiveName
        }
        this.newOrder.detailForm = params
        await NEDB.updateOrder(this.newOrder)
      }
    },
    mounted () {
      this.initData()
    }
  }
</script>

<style scoped lang="scss">
  .outer-box {
    padding: 20px;
    border: 1px solid rgb(224, 221, 221);
    max-width: 1200px;
    .action {
      height: 40px;
    }
    .sell-title {
      display: flex;
      justify-content: space-between;
    }
    .editInput {
      .middle {
        width: 80px;
      }
      input {
        border: none;
      }
      .small {
        width: 60px;
      }
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
