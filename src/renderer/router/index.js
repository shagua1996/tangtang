import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'landing-page',
      component: require('@/components/LandingPage').default
    },
    {
      path: '/history',
      name: 'history',
      component: resolve => require(['@/components/history'], resolve),
      meta: { title: 'history', noCache: true }
    },
    {
      path: '/setting',
      name: 'setting',
      component: require('@/components/setting').default,
      meta: { title: 'setting', noCache: true }
    },
    {
      path: '/order',
      name: 'order',
      component: require('@/components/order').default,
      meta: { title: 'order', noCache: true }
    }
  ]
})

const VueRouterPush = Router.prototype.push
Router.prototype.push = function push (to) {
  return VueRouterPush.call(this, to).catch(err => err)
}
