import { defineRouter } from '#q-app/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'

const decodeToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const getAuthRole = () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload || payload.exp * 1000 < Date.now()) return null
  return payload.role // 'ADMIN' | 'TEAM'
}

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.beforeEach((to) => {
    const role = getAuthRole()

    // Already logged in → redirect away from login page
    if (to.path === '/') {
      if (role === 'ADMIN') return '/admin'
      if (role === 'TEAM') return '/team/map'
    }

    // Protect admin routes
    if (to.path.startsWith('/admin') && role !== 'ADMIN') return '/'

    // Protect team routes
    if (to.path.startsWith('/team') && role !== 'TEAM') return '/'
  })

  return Router
})
