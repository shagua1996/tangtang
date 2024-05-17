<template lang="pug">
  <div id="order">
    el-tabs.content-width(v-model="activeName")
      el-tab-pane(label="销售单", name="first")
        .outer-box#saleOrder
          .name.f-p-5.f-tac.f-fs-16 芃悦居木门销售单
          .sell-title.f-m-t-20
            span 订单编号：{{ newOrder.orderForm.no }}
            span 日期: {{ newOrder.createAt | date('YYYY-MM-DD') }}
          table.production-table.f-m-t-10
            thead
              tr
                th(colspan="3") 经销商名称: {{ newOrder.orderForm.dealerName }}
                th(colspan="5") 地址: {{ newOrder.orderForm.dealerAddress }}
                th(colspan="2") 电话: {{ newOrder.orderForm.call }}
              tr
                th(colspan="3") 客户名称：{{ newOrder.orderForm.clientName }}
                th(colspan="5") 地址：{{ newOrder.orderForm.clientAddress }}
                th(colspan="2") 交货日期：{{ newOrder.orderForm.deliveryDate | date}}
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
                td ￥{{ item.price }}
                td ￥{{ item.singlePrice}}
              tr
                td(colspan="8")
                td(colspan="2").f-fwb 合计金额：￥ {{ newOrder.totalPrice | formatMoney }}
              tr 
                td(colspan="10") 备注：{{ newOrder.orderForm.orderNote }}
              tr
                td(colspan="5")
                  .editInput.f-fwb
                    label.middle(for="pay") 应付金额：
                    input.big(v-model="yingPay", size="mini", id="pay")
                td(colspan="5")
                  .editInput.f-fwb
                    label.middle(for="realPay") 实付金额：
                    input.big(v-model="amountPay", size="mini", id="realPay")
              tr
                td(colspan="3")
                  .editInput
                    label(for="company") 销售单位：
                    input(v-model="saleCompany", size="mini", id="company")
                td(colspan="4")
                  .editInput
                    label(for="address") 地址：
                    input.big(v-model="companyAdress", type="textarea", size="mini", id="address")
                td(colspan="2")
                  .editInput
                    label(for="contact") 联系人：
                    input.small(v-model="contactName", size="mini", id="contact")
                td
                  .editInput
                    label(for="phone") 电话：
                    input(v-model="contact", size="mini", id="phone")
              tr
                td(colspan="10")
                  .editInput.f-fwb
                    label.middle(for="recieve") 收货人：
                    input(v-model="receiveName", size="mini", id="recieve")
        .footer.f-tar.f-p-t-10
          el-button.f-m-r-10(type="primary", v-print="printObj", @click="saveForm") 打印
          el-button(type="primary", @click="saveForm") 确认并保存
      el-tab-pane(label="生产单", name="second")
        product-order(:productData="newOrder")
  </div>
</template>

<script>
  import ProductOrder from '@/components/table/productOrder'
  import SaleOrder from '@/components/table/saleOrder'
  import NEDB from '@/lib/nedb'
  export default {
    name: 'order-list',
    data () {
      return {
        totalPrice: 0,
        amountPay: '',
        yingPay: '',
        saleCompany: '浙江永康芃悦居木门有限公司',
        companyAdress: '恩施市阳雀坝',
        contact: '13310559908',
        contactName: '丁先生',
        receiveName: '',
        newOrder: {
          orderId: 0,
          orderForm: {},
          orderSize: {}
        },
        activeName: 'first',
        printObj: {
          id: 'saleOrder'
        }
      }
    },
    components: {
      'product-order': ProductOrder,
      'sale-order': SaleOrder
    },
    methods: {
      async initData () {
        this.newOrder = window.appData.currentOrderData
        console.log('this.new', this.newOrder)
      },
      async saveForm () {
        let params = {
          amountPay: this.amountPay,
          yingPay: this.yingPay,
          saleCompany: this.saleCompany,
          companyAdress: this.companyAdress,
          contact: this.contact,
          contactName: this.contactName,
          receiveName: this.receiveName
        }
        // this.newOrder.detailForm = params
        await NEDB.updateOrder({ orderId: this.newOrder.orderId, detailForm: params })
      }
    },
    mounted () {
      this.initData()
    }
  }
</script>

<style scoped lang="scss">
.outer-box {
  padding: 20px 0;
  // border: 1px solid rgb(224, 221, 221);
  min-width: 1000px;
  max-width: 1200px;

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

    .big {
      width: 260px;
    }
  }
}

table {
  width: 100%;
  border-collapse: collapse;
}

tr,
th,
td {
  text-align: left;
  padding: 10px;
  border: solid 1px rgb(224, 221, 221);
}
</style>
