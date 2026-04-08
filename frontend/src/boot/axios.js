import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({ baseURL: API_BASE })

// ── Request: attach token ─────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: silent refresh on 401 ──────────────────────────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
  failedQueue = []
}

api.interceptors.response.use(
  res => res, // pass-through on success
  async error => {
    const original = error.config

    // Skip if it's the refresh call itself failing (avoid infinite loop)
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue subsequent 401s until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      const oldToken = localStorage.getItem('token')
      try {
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${oldToken}` } }
        )
        const newToken = data.access_token
        localStorage.setItem('token', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        // Refresh also failed → force re-login
        localStorage.removeItem('token')
        delete api.defaults.headers.common.Authorization
        window.location.href = '/'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ── Proactive silent refresh every 50 min ────────────────────────────────────
const scheduleProactiveRefresh = () => {
  setInterval(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const { data } = await axios.post(
        `${API_BASE}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      localStorage.setItem('token', data.access_token)
      api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
    } catch {
      // Will be handled by the response interceptor on next real request
    }
  }, 50 * 60 * 1000) // every 50 minutes
}

export default defineBoot(({ app }) => {
  // If token was stored as session-only, clear it when the browser session ends
  if (localStorage.getItem('token') && localStorage.getItem('sessionOnly') === 'true') {
    if (!sessionStorage.getItem('sessionActive')) {
      localStorage.removeItem('token')
      localStorage.removeItem('sessionOnly')
    }
  }

  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
  scheduleProactiveRefresh()
})

export { api }
