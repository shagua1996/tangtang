<template lang="pug">
  #setting
    .f-m-t-10.f-fs-16.f-fwb 设置
    el-form.f-m-t-20(:inline="true", :model="defaultSet.baseForm")
      .item-title.f-fs-14.f-fwb 尺寸计算
      el-form-item(label="门板宽差量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.doorWidthDiff")
      el-form-item(label="门板高差量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.doorHeightDiff")
      el-form-item(label="木方宽差量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.woodWidthDiff")
      el-form-item(label="木方高差量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.woodHeightDiff")
      <br/>
      el-form-item(label="门套宽增量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.doorCoverAdd")
      el-form-item(label="墙厚增量:")
        el-input.small(size="mini" type="number" v-model="defaultSet.baseForm.wallAdd")
      .item-title.f-fs-14.f-fwb 其它信息
      .form-item.f-dflex.f-m-t-10
        .list
          .label.f-m-b-10 已有型号：
          .all-type.beautify-scrollbar
            .type.f-m-t-5(v-for="type, index in defaultSet.typeOptions")
              span.f-fs-12 {{ type.value }}
              span.f-csp.s-fc-link.f-fs-12(@click="removeType(index)") 移除
        .add.f-m-l-20
          .label.f-m-b-10 添加型号：
          .input.f-dflex
            el-input(size="mini", v-model.trim="addType")
            el-button.f-m-l-5(size="mini", type="primary", @click="submitType") 添加
      .form-item.f-dflex.f-m-t-10
        .list
          .label.f-m-b-10 已有颜色：
          .all-type.beautify-scrollbar
            .type.f-m-t-5(v-for="type, index in defaultSet.colorOptions")
              span.f-fs-12 {{ type.value }}
              span.f-csp.s-fc-link.f-fs-12(@click="removeColor(index)") 移除
        .add.f-m-l-20
          .label.f-m-b-10 添加颜色：
          .input.f-dflex
            el-input(size="mini", v-model.trim="addColor")
            el-button.f-m-l-5(size="mini", type="primary", @click="submitColor") 添加
      .form-item.f-dflex.f-m-t-10
        .list
          .label.f-m-b-10 已有的材质：
          .all-type.beautify-scrollbar
            .type.f-m-t-5(v-for="type, index in defaultSet.texturesOptions")
              span.f-fs-12 {{ type.value }}
              span.f-csp.s-fc-link.f-fs-12(@click="removeTextrue(index)") 移除
        .add.f-m-l-20
          .label.f-m-b-10 添加材质：
          .input.f-dflex
            el-input(size="mini", v-model.trim="addTextures")
            el-button.f-m-l-5(size="mini", type="primary", @click="submitTextrues") 添加
    .footer.f-tar
      el-button(type="primary", @click="saveSettings") 保存设置
  </template> 

<script>
  import { defaultSetting } from '@/config/base-info'
  import _ from 'lodash'
  import NEDB from '@/lib/nedb'
  export default {
    name: 'setting',
    data () {
      return {
        addType: '',
        addColor: '',
        addTextures: '',
        isSetting: '',
        defaultSet: {
          version: defaultSetting.version,
          baseForm: defaultSetting.baseForm,
          typeOptions: [],
          colorOptions: [],
          texturesOptions: []
        }
      }
    },
    methods: {
      async initData () {
        this.isSetting = await NEDB.getSetting()
        if (this.isSetting.length > 0 && this.isSetting[0].baseForm) {
          this.defaultSet = this.isSetting[0]
        }
      },
      // 移除类型
      removeType (typeIndex) {
        this.defaultSet.typeOptions.splice(typeIndex, 1)
      },
      removeColor (colorIndex) {
        this.defaultSet.colorOptions.splice(colorIndex, 1)
      },
      removeTextrue (textIndex) {
        this.defaultSet.texturesOptions.splice(textIndex, 1)
      },
      // 添加类型
      submitType () {
        if (!this.addType) return
        if (_.find(this.defaultSet.typeOptions, ['value', this.addType])) return this.$message.warning('类型已存在')
        const params = {
          value: this.addType,
          label: this.addType
        }
        this.defaultSet.typeOptions.unshift(params)
      },
      submitTextrues () {
        if (!this.addTextures) return
        if (_.find(this.defaultSet.texturesOptions, ['value', this.addTextures])) return this.$message.warning('材质类型已存在')
        const params = {
          value: this.addTextures,
          label: this.addTextures
        }
        this.defaultSet.texturesOptions.unshift(params)
      },
      submitColor () {
        if (!this.addColor) return
        if (_.find(this.defaultSet.colorOptions, ['value', this.addColor])) return this.$message.warning('颜色已存在')
        const params = {
          value: this.addColor,
          label: this.addColor
        }
        this.defaultSet.colorOptions.unshift(params)
      },
      // 保存
      async saveSettings () {
        console.log('11', this.isSetting, this.defaultSet)
        if (!this.isSetting[0]) {
          await NEDB.addSetting(this.defaultSet)
          this.initData()
        } else {
          await NEDB.updateSetting(this.defaultSet)
        }
        this.$message.success('保存成功')
      }
    },
    mounted () {
      this.initData()
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
    margin-left: 20px;
    .middle {
      width: 100px;
    }
    .small {
      width: 70px;
    }
  }
  .form-item {
    margin-left: 20px;
    .all-type {
      width: 100px;
      height: 150px;
      padding: 5px 10px;
      border: 1px solid #e6e6e6;
      border-radius: 5px;
      overflow: auto;
      .type {
        width: 100px;
        display: flex;
        justify-content: space-between;
      }
    }
  }
</style>>

