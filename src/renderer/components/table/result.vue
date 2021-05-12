<template>
  <div id="result">
    <table id="resTable">
      <thead>
        <tr>
          <th colspan="4">洞口尺寸</th>
          <th rowspan="2">门厚</th>
          <th>门板尺寸</th>
          <th colspan="2">木方尺寸</th>
          <th colspan="4">门套尺寸</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
        <tr>
          <th colspan="4">宽*高*墙厚</th>
          <th>宽*高</th>
          <th>横枋</th>
          <th>竖枋</th>
          <th colspan="2">门开方向（宽*长*数量）</th>
          <th colspan="2">反方向（宽*长*数量）</th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="item, index in tabResultArr">
          <tr>
            <td colspan="4"> {{ item.holeWidth + '*' + item.holeHeight + '*' + item.wallWidth}} </td>
            <td> {{ item.doorWidth }} </td>
            <td> {{ item.doorSize }} </td>
            <td> {{ item.woodSize.hengFang }} </td>
            <td> {{ item.woodSize.shufang }} </td>
            <td> {{ item.coverSize.widthOne }} </td>
            <td> {{ item.coverSize.widthTwo }} </td>
            <td> {{ item.coverSize.heightOne }} </td>
            <td> {{ item.coverSize.heightTwo }} </td>
            <td> {{ item.note }} </td>
            <td>
              <el-button size="mini" @click="deleteCase(item.createDate)">删除</el-button>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
  import NEDB from '@/lib/nedb'
  export default {
    name: 'table-result',
    props: {
      tableData: Array
    },
    data () {
      return {
        tabResultArr: []
      }
    },
    methods: {
      setTableData () {
        this.tabResultArr = this.tableData
      },
      async deleteCase (item) {
        let result = await NEDB.deleteCase({ createDate: item })
        if (result > 0) {
          this.tabResultArr = await NEDB.findCase()
        }
      }
    },
    mounted () {
      this.setTableData()
    },
    watch: {
      tableData: {
        handler: 'setTableData',
        immediate: true,
        deep: true
      }
    }
  }
</script>

<style>
  #result {
    margin-top: 10px;
  }
  table {
    border-collapse: collapse;
  }
  table, tr, th, td {
    padding: 10px;
    border: solid 1px rgb(224, 221, 221);
  }
</style>
