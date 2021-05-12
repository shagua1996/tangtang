<template lang="pug">
  #setting
    .f-m-t-20.f-fs-16.f-fwb 设置
    el-form.f-m-t-20(:inline="true")
      el-form-item(label="门板宽差量:")
        el-input.small(size="mini" type="number" v-model="baseForm.doorWidthDiff")
      el-form-item(label="门板高差量:")
        el-input.small(size="mini" type="number" v-model="baseForm.doorHeightDiff")
      <br/>
      el-form-item(label="木方宽差量:")
        el-input.small(size="mini" type="number" v-model="baseForm.woodWidthDiff")
      el-form-item(label="木方高差量:")
        el-input.small(size="mini" type="number" v-model="baseForm.woodHeightDiff")
      <br/>
      el-form-item(label="门套宽增量:")
        el-input.small(size="mini" type="number" v-model="baseForm.doorCoverAdd")
      el-form-item(label="墙厚增量:")
        el-input.small(size="mini" type="number" v-model="baseForm.wallAdd")
</template>

<script>
  import { BaseData } from '@/config/base-info'
  export default {
    name: 'setting',
    data () {
      return {
        baseForm: BaseData
      }
    },
    methods: {
    },
    mounted () {
    }
  }
</script>

<style scoped lang='scss'>
  #setting {
    .setting-items {
      color: rgb(143, 141, 145);
    }
  }
  .el-form-item {
    .middle {
      width: 100px;
    }
    .small {
      width: 70px;
    }
  }
</style>>

