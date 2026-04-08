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

    // Skip if it's the refresh call itself or already retried (avoid infinite loop)
    const isRefreshCall = original.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && !original._retry && !isRefreshCall) {
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
    if (!token) return // token was removed (logout in another tab) — skip silently
    try {
      const { data } = await axios.post(
        `${API_BASE}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // Only save if the token in storage is still the same one we refreshed
      if (localStorage.getItem('token') === token) {
        localStorage.setItem('token', data.access_token)
        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
      }
    } catch {
      // Will be handled by the response interceptor on next real request
    }
  }, 50 * 60 * 1000) // every 50 minutes
}

// ── Cross-tab session sync via BroadcastChannel ───────────────────────────────
// sessionStorage is per-tab, so a new tab doesn't inherit "sessionActive".
// We use BroadcastChannel: new tabs ask existing tabs if a session is alive,
// and any existing tab responds immediately so the new tab can set the flag
// before the session-only check runs.
// ── Auth ready promise ────────────────────────────────────────────────────────
// The boot function is async (cross-tab session query). The router guard must
// wait for it to finish before evaluating auth state, otherwise it reads a
// token that may be about to be cleared.
let _resolveAuthReady
export const authReady = new Promise((resolve) => { _resolveAuthReady = resolve })

const SESSION_CHANNEL = 'oriento_session'
let sessionChannel = null

const initSessionChannel = () => {
  if (!('BroadcastChannel' in window)) return
  sessionChannel = new BroadcastChannel(SESSION_CHANNEL)
  sessionChannel.onmessage = (e) => {
    if (e.data === 'session-query' && sessionStorage.getItem('sessionActive')) {
      sessionChannel.postMessage('session-alive')
    }
  }
}

const querySessionFromOtherTabs = () => {
  return new Promise((resolve) => {
    if (!('BroadcastChannel' in window)) { resolve(false); return }
    const ch = new BroadcastChannel(SESSION_CHANNEL)
    const timer = setTimeout(() => { ch.close(); resolve(false) }, 150)
    ch.onmessage = (e) => {
      if (e.data === 'session-alive') {
        clearTimeout(timer)
        ch.close()
        resolve(true)
      }
    }
    ch.postMessage('session-query')
  })
}

export default defineBoot(async ({ app }) => {
  initSessionChannel()

  // If token was stored as session-only, clear it when the browser session ends.
  // Skip in standalone PWA mode — the OS kills the process and wipes sessionStorage,
  // which would log users out on every reopen.
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  if (!isStandalone && localStorage.getItem('token') && localStorage.getItem('sessionOnly') === 'true') {
    if (!sessionStorage.getItem('sessionActive')) {
      // Ask other open tabs if a session is alive (handles links opening in new tabs)
      const alive = await querySessionFromOtherTabs()
      if (alive) {
        sessionStorage.setItem('sessionActive', 'true')
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('sessionOnly')
      }
    }
  }

  _resolveAuthReady()
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
  scheduleProactiveRefresh()
})

export { api }
