<template lang="pug">
  #main
    .top.f-dflex
      .calc-box
        .title 洞口尺寸(单位：mm(毫米))
        el-form(:inline="true", :model="holeData", :rules="rules", ref="holeData")
          el-form-item(label="宽:", prop="holeWidth")
            el-input.middle(size="mini" type="number" v-model="holeData.holeWidth") 
          el-form-item(label="高:", prop="holeHeight")
            el-input.middle(size="mini" type="number" v-model="holeData.holeHeight")
          el-form-item(label="墙厚:", prop="wallWidth") 
            el-input.middle(size="mini" type="number" v-model="holeData.wallWidth")
          el-form-item(label="门厚:", prop="doorWidth")
            el-input.middle(size="mini" type="number" v-model="holeData.doorWidth")
          <br/>
          el-form-item(label="型号:", prop="type")
            //- el-input.middle(size="mini" type="text" v-model="holeData.type")
            el-select.small(v-model="holeData.type", filterable, size="mini")
              el-option(v-for="item in baseForm.typeOptions", :key="item.value", :label="item.label", :value="item.value")
          el-form-item(label="颜色:", prop="color")
            el-select.small(v-model="holeData.color", filterable, size="mini")
              el-option(v-for="item in baseForm.colorOptions", :key="item.value", :label="item.label", :value="item.value")
          el-form-item(label="材质:", prop="textrues")
            el-select.small(size="mini", v-model="holeData.textrues", filterable)
              el-option(v-for="item in baseForm.texturesOptions", :key="item.value", :label="item.label", :value="item.value")
          <br/>
          el-form-item(label="数量:", prop="number")
            el-input.middle(size="mini" type="number" v-model="holeData.number")
          el-form-item(label="单位:", prop="unit")
            el-select.small(size="mini", v-model="holeData.unit", filterable)
              el-option(v-for="item in units", :key="item.value", :label="item.label", :value="item.value")
          el-form-item(label="单价:", prop="price")
            el-input.middle(size="mini" type="number" v-model="holeData.price")
          <br/>
          el-form-item(label="备注:", prop="sizeNote")
            el-input.textarea(type="textarea", maxlength="30", show-word-limit, v-model="holeData.sizeNote")
          <br/>
          el-form-item.button-right
            el-button(type="primary" @click="resetForm('holeData')") 重置
            el-button.f-m-l-10(type="primary" @click="submit('holeData')") 立即计算
      .tip-box.f-m-l-10
        el-card
          .header(slot="header") 当前计算公式：
          .tip-text.f-fs-12
            p 门板尺寸： (宽 - {{ baseForm.baseForm.doorWidthDiff }}) * (高 - {{ baseForm.baseForm.doorHeightDiff }})
            p 横方：(门板宽 - {{ baseForm.baseForm.woodWidthDiff }}) * 4
            p 竖方：(门板高 - {{ baseForm.baseForm.woodHeightDiff }}) * 2
            p 门开放向：(门厚 + {{ baseForm.baseForm.doorCoverAdd }}) * 高/宽 * 数量
            p 反放向：(墙厚 + {{ baseForm.baseForm.wallAdd }} - 门开方向厚度) * 高/宽 * 数量
    .result-box
      .header
        .title.f-fwb.f-fs-16 计算结果
        .button
          el-button(type="primary", size="mini", @click="showOrderDlg") 生成生产单和销售单
      el-table.f-m-t-20(:data="getResultArr", height="500", :border="false")
        el-table-column(label="洞口尺寸")
          el-table-column(label="宽*高*墙厚", width="135")
            template(slot-scope="scope") {{ scope.row.holeSize }}
        el-table-column(label="门板尺寸")
          el-table-column(label="宽*高")
            template(slot-scope="scope") {{ scope.row.doorSize }}
        el-table-column(label="木方尺寸")
          el-table-column(label="横方")
            template(slot-scope="scope") {{ scope.row.woodSize.hengFang }}
          el-table-column(label="竖方")
            template(slot-scope="scope") {{ scope.row.woodSize.shufang }}
        el-table-column(label="门套尺寸")
          el-table-column(label="门开方向", width="120")
            template(slot-scope="scope") 
              div {{ scope.row.coverSize.widthOne }}
              div {{ scope.row.coverSize.widthTwo }}
          el-table-column(label="反方向", width="120")
            template(slot-scope="scope") 
              div {{ scope.row.coverSize.heightOne }}
              div {{ scope.row.coverSize.heightTwo }}
        el-table-column(label="型号")
          template(slot-scope="scope") {{ scope.row.type }}
        el-table-column(label="颜色")
          template(slot-scope="scope") {{ scope.row.color }}
        el-table-column(label="材质")
          template(slot-scope="scope") {{ scope.row.textrues }}
        el-table-column(label="单位")
          template(slot-scope="scope") {{ scope.row.unit }}
        el-table-column(label="数量")
          template(slot-scope="scope") {{ scope.row.number }}
        el-table-column(label="单价")
          template(slot-scope="scope") {{ scope.row.price }}
        el-table-column(label="备注")
          template(slot-scope="scope") {{ scope.row.sizeNote }}
        el-table-column(label="操作", width="100")
          template(slot-scope="scope")
            el-button(@click.native.prevent="deleteRow(scope.$index, getResultArr)", type="text", size="small") 移除
    el-dialog(title="创建订单", :visible.sync="orderDlgVisible", :close-on-click-modal="false")
      .box
        el-form(:form="orderForm", label-width="100px")
          el-form-item(label="订单编号", :rules="{ required: true}")
            el-input(v-model.trim="orderForm.no", placeholder="请输入订单编号（必填）")
          el-form-item(label="经销商名称")
            el-input(v-model.trim="orderForm.dealerName")
          el-form-item(label="电话")
            el-input(v-model.trim="orderForm.call", maxlength="11")
          el-form-item(label="经销商地址")
            el-input(v-model.trim="orderForm.dealerAddress")
          el-form-item(label="客户名称")
            el-input(v-model.trim="orderForm.clientName")
          el-form-item(label="客户地址")
            el-input(v-model.trim="orderForm.clientAddress")
          el-form-item(label="交货日期")
            el-date-picker(v-model="orderForm.deliveryDate", type="date", placeholder="选择日期")
          el-form-item(label="订单备注")
            el-input(type="textarea", v-model.trim="orderForm.orderNote")
      span(slot="footer")
        el-button(@click="orderDlgVisible = false") 取消
        el-button(type="primary", @click="handleSubmit", :disabled="!orderForm.no") 确定
</template>

<script>
  import NEDB from '@/lib/nedb'
  import Bus from '@/lib/bus'
  import _ from 'lodash'
  import Vue from 'vue'
  import { defaultSetting } from '@/config/base-info'
  export default {
    name: 'landing-page',
    data () {
      return {
        indexStr: '001',
        holeData: {
          holeWidth: 0,
          holeHeight: 0,
          wallWidth: 0,
          doorWidth: 0,
          type: '',
          color: '',
          textrues: '',
          number: 1,
          unit: '套',
          price: '',
          sizeNote: ''
        },
        baseForm: defaultSetting,
        tData: {
          doorSize: '',
          woodSize: {},
          coverSize: {}
        },
        orderForm: {
          no: '',
          dealerName: '',
          call: '',
          dealerAddress: '',
          clientName: '',
          clientAddress: '',
          deliveryDate: '',
          orderNote: ''
        },
        submitData: {},
        getResultArr: [],
        orderDlgVisible: false,
        units: [
          {
            label: '套',
            value: '套'
          }, {
            label: '米',
            value: '米'
          }
        ],
        rules: {
          holeWidth: [
            { required: true, message: '请输入数字', trigger: 'blur' }
          ],
          holeHeight: [
            { required: true, message: '请输入数字', trigger: 'blur' }
          ],
          wallWidth: [
            { required: true, message: '请输入数字', trigger: 'blur' }
          ],
          doorWidth: [
            { required: true, message: '请输入数字', trigger: 'blur' }
          ]
        }
      }
    },
    methods: {
      async initOrderNo () {
        let no = Vue.filter('date')((new Date().getTime()), 'YYYYMMDD') + this.indexStr
        let exist = await NEDB.findOrderByNo(no)
        console.log('exit', exist)
        if (exist) {
          let num = Number(this.indexStr) + 1
          this.indexStr = _.padStart(num, 3, '0')
          this.initOrderNo(this.indexStr)
        } else {
          this.orderForm.no = no
        }
      },
      initForm () {
        setTimeout(async () => {
          let setting = await NEDB.getSetting()
          console.log('setting', setting)
          if (setting.length > 0) {
            this.baseForm = setting[0]
          }
        }, 300)
      },
      async submit (formName) {
        this.$refs[formName].validate(async (valid) => {
          if (valid) {
            /* 根据洞口尺寸计算其他尺寸 */
            let baseData = this.baseForm.baseForm
            let doorWidthSize = this.holeData.holeWidth - baseData.doorWidthDiff
            let doorHeightSize = this.holeData.holeHeight - baseData.doorHeightDiff
            let cHengfang = doorWidthSize - parseFloat(baseData.woodWidthDiff)
            let cShufang = doorHeightSize - parseFloat(baseData.woodHeightDiff)
            let coverWidthOne = parseFloat(this.holeData.doorWidth) + parseFloat(baseData.doorCoverAdd)
            let coverWidthTwo = parseFloat(this.holeData.wallWidth) + parseFloat(baseData.wallAdd) - coverWidthOne
            this.tData.createDate = Date.now()
            this.tData.holeSize = this.holeData.holeWidth + '*' + this.holeData.holeHeight + '*' + this.holeData.wallWidth
            this.tData.doorSize = doorWidthSize + '*' + doorHeightSize
            this.tData.woodSize.hengFang = cHengfang + '*4'
            this.tData.woodSize.shufang = cShufang + '*2'
            this.tData.coverSize.widthOne = coverWidthOne + '*' + this.holeData.holeHeight + '*2'
            this.tData.coverSize.widthTwo = coverWidthOne + '*' + this.holeData.holeWidth + '*1'
            this.tData.coverSize.heightOne = coverWidthTwo + '*' + this.holeData.holeHeight + '*2'
            this.tData.coverSize.heightTwo = coverWidthTwo + '*' + this.holeData.holeWidth + '*1'
            this.tData.singlePrice = this.holeData.price * this.holeData.number
            Object.assign(this.tData, this.holeData)
            const currentResult = _.cloneDeep(this.tData)
            this.getResultArr.unshift(currentResult)
            await NEDB.addCase(this.tData)
          } else {
            return false
          }
        })
      },
      resetForm (formName) {
        this.$refs[formName].resetFields()
        this.getResultArr = []
      },
      deleteRow (index, rows) {
        rows.splice(index, 1)
      },
      showOrderDlg () {
        if (this.getResultArr.length <= 0) {
          return this.$message.warning('请先计算订单所需要的尺寸信息')
        }
        this.orderDlgVisible = true
      },
      async handleSubmit () {
        // 提交订单数据
        const sizeList = _.cloneDeep(this.getResultArr)
        let sum = _.sumBy(sizeList, 'singlePrice')
        this.submitData.sizeList = sizeList
        this.submitData.createAt = Date.now()
        this.submitData.orderId = this.orderForm.no
        this.submitData.orderForm = this.orderForm
        this.submitData.totalPrice = sum
        window.appData.currentOrderData = this.submitData
        console.log('submitdata::', this.submitData)
        await NEDB.addOrder(this.submitData)
        this.orderDlgVisible = false
        this.$router.push({ path: '/order' })
        Bus.$emit('showOrder')
      }
    },
    activated () {
      this.initForm()
    },
    watch: {
      orderDlgVisible (val) {
        if (val) {
          this.initOrderNo(this.indexStr)
        }
      }
    }
  }
</script>

<style scoped lang="scss">
  .calc-box {
    margin-bottom: 10px;
    width: 60%;
    height: 320px;
    padding: 20px;
    border: 1px solid rgb(224, 221, 221);
    border-radius: 10px;
    position: relative;
  }
  .result-box {
    max-width: 1280px;
    padding: 10px;
    border: 1px solid rgb(224, 221, 221);
    border-radius: 10px;
    .header {
      display: flex;
      justify-content: space-between;
    }
  }
  .content {
    display: flex;
  }
  .item {
    width: 200px;
  }
  .el-form {
    margin-top: 10px;
    position: relative;
  }
  .el-form-item {
    .middle, .small {
      width: 100px;
    }
    .textarea {
      width: 300px;
    }
  }
  .button-right {
    position: absolute;
    right: 0;
  }
</style>
