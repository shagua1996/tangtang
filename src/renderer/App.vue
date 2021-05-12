<template>
  <div id="app">
    <div class="side-bar">
      <side-nav></side-nav>
    </div>
    <div class="main">
      <keep-alive include="landing-page">
        <router-view></router-view>
      </keep-alive>
    </div>
  </div>
</template>

<script>
  import SideNav from '@/components/sidenav.vue'
  export default {
    name: 'my-project',
    components: {
      'side-nav': SideNav
    }
  }
</script>

<style scoped lang="scss">
  /* CSS */
  #app {
    display: flex;
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
    box-sizing: border-box;
    .side-bar {
      width: 100px;
      padding: 10px 20px;
    }
  }
</style>>

