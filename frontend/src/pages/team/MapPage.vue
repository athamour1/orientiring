<template>
  <q-page class="relative-position" style="overflow: hidden;">
    <div id="map" class="absolute-full"></div>

    <!-- Completion Banner -->
    <transition name="slide-down">
      <div v-if="allDone" class="completion-banner" @click="bannerDismissed = true">
        <div class="banner-inner">
          <div class="trophy">🏆</div>
          <div class="banner-title">{{ $t('allCheckpointsDone') }}</div>
          <div class="banner-sub">{{ $t('headBackToStart') }}</div>
          <div class="banner-hint">{{ $t('tapToDismiss') }}</div>
        </div>
      </div>
    </transition>

    <!-- Locate me button -->
    <q-btn
      round unelevated
      icon="my_location"
      :color="followMode ? 'primary' : 'white'"
      :text-color="followMode ? 'white' : 'primary'"
      size="md"
      class="locate-btn shadow-4"
      :disable="!lastSentLat"
      @click="locateMe"
    />

    <!-- GPS blocked overlay -->
    <transition name="fade">
      <div v-if="gpsBlocked" class="gps-overlay">
        <div class="gps-card">
          <div class="gps-icon">📍</div>
          <div class="gps-title">{{ $t('gpsRequired') }}</div>
          <div class="gps-body">{{ gpsPermissionDenied ? $t('gpsPermissionDenied') : $t('gpsUnavailable') }}</div>
          <div v-if="gpsPermissionDenied" class="gps-hint">{{ $t('gpsEnableHint') }}</div>
          <q-btn
            unelevated rounded color="primary" size="lg" no-caps
            :label="$t('retryGps')"
            :loading="gpsRetrying"
            class="q-mt-lg full-width"
            @click="retryGps"
          />
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup>
import { onMounted, ref, onUnmounted, watch } from 'vue'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const map = ref(null)
const $q = useQuasar()
const { t, locale } = useI18n()
const markers = ref([])
const activeEvent = ref(null)
const userMarker = ref(null)
const allDone = ref(false)
const bannerDismissed = ref(false)
const gpsBlocked = ref(false)
const gpsPermissionDenied = ref(false)
const gpsRetrying = ref(false)
const followMode = ref(false)
let watchId = null
let eventInterval = null
let initialMapFit = false
let lastSentLat = null
let lastSentLng = null
let lastSentTime = 0
let locationSocket = null

function locateMe() {
  if (lastSentLat !== null && map.value) {
    followMode.value = true
    map.value.setView([lastSentLat, lastSentLng], 19, { animate: true })
  }
}

function onGpsError(err) {
  console.error(err)
  gpsBlocked.value = true
  // code 1 = PERMISSION_DENIED, code 2 = POSITION_UNAVAILABLE, code 3 = TIMEOUT
  gpsPermissionDenied.value = err.code === 1
}

async function retryGps() {
  gpsRetrying.value = true
  // Clear the existing (failed) watch first
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }

  try {
    // getCurrentPosition re-triggers the browser prompt on some platforms
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
    })
    // Success — permission granted, restart the watch
    gpsBlocked.value = false
    gpsPermissionDenied.value = false
    watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, { enableHighAccuracy: true })
  } catch (err) {
    onGpsError(err)
  } finally {
    gpsRetrying.value = false
  }
}

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

onMounted(async () => {
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' })
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' })
  const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© CartoDB'
  })

  const initialLayer = $q.dark.isActive ? dark : street

  map.value = L.map('map', {
    center: [0, 0],
    zoom: 2,
    layers: [initialLayer]
  })

  // Disarm follow mode when the user manually drags or zooms
  map.value.on('dragstart', () => { followMode.value = false })
  map.value.on('zoomstart', (e) => { if (e.originalEvent) followMode.value = false })

  L.control.layers({
    "🌙 Dark": dark,
    "🗺️ Street": street,
    "⛰️ Topographic": topo,
    "🛰️ Satellite": satellite
  }).addTo(map.value)

  // Auto-swap base tile when dark mode toggles
  let activeBase = initialLayer
  watch(() => $q.dark.isActive, (isDark) => {
    const next = isDark ? dark : street
    map.value.removeLayer(activeBase)
    next.addTo(map.value)
    activeBase = next
  })

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  // Connect socket for sending location updates (no polling REST)
  locationSocket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token: localStorage.getItem('token') },
  })

  await fetchEvent()
  eventInterval = setInterval(fetchEvent, 30000)

  // Always track GPS — admin needs location data even when showTeamLocation is off
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, { enableHighAccuracy: true })
  } else {
    gpsBlocked.value = true
    gpsPermissionDenied.value = false
  }
})

async function onPosition(pos) {
  const { latitude, longitude } = pos.coords

  // Follow mode — keep map centred on the team
  if (followMode.value && map.value) {
    map.value.panTo([latitude, longitude], { animate: true, duration: 0.5 })
  }

  // Only show team's own dot on their map if admin hasn't hidden locations
  if (activeEvent.value?.showTeamLocation !== false) {
    if (!userMarker.value) {
      userMarker.value = L.circleMarker([latitude, longitude], {
        color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.9, radius: 10, weight: 3
      }).bindPopup('<b>📍 ' + t('yourTeam') + '</b>').addTo(map.value)
      if (markers.value.length === 0) {
        map.value.setView([latitude, longitude], 16)
      }
    } else {
      userMarker.value.setLatLng([latitude, longitude])
    }
  }

  const now = Date.now()
  const movedEnough = lastSentLat === null ||
    haversineMetres(lastSentLat, lastSentLng, latitude, longitude) > 10
  const enoughTime = now - lastSentTime > 4000
  if (movedEnough || enoughTime) {
    locationSocket?.emit('location:update', { latitude, longitude })
    lastSentLat = latitude
    lastSentLng = longitude
    lastSentTime = now
  }
}

onUnmounted(() => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  if (eventInterval) clearInterval(eventInterval)
  locationSocket?.disconnect()
})

const fetchEvent = async () => {
  try {
    const res = await api.get('/team/events/active')
    activeEvent.value = res.data

    // Apply language set by the admin for this event
    if (res.data?.language) {
      locale.value = res.data.language
      localStorage.setItem('appLang', res.data.language)
    }

    // showTeamLocation only controls visibility of the team's own dot on their map
    // GPS is always sent to the server so the admin can always track teams
    if (userMarker.value) {
      if (activeEvent.value?.showTeamLocation === false) {
        map.value?.removeLayer(userMarker.value)
        userMarker.value = null
      }
    }

    if (!activeEvent.value || activeEvent.value === '') {
      return
    }

    if (activeEvent.value.checkpoints && activeEvent.value.checkpoints.length > 0) {
      // Clear legacy markers from prior iterations
      markers.value.forEach(m => map.value?.removeLayer(m))
      markers.value = []

      activeEvent.value.checkpoints.forEach(cp => {
        const isScanned = activeEvent.value.scannedCheckpointIds?.includes(cp.id)
        
        const color = isScanned ? '#43a047' : '#e53935'
        const marker = L.circleMarker([cp.latitude, cp.longitude], {
          radius: 11,
          weight: 3,
          color: isScanned ? '#2e7d32' : '#b71c1c',
          fillColor: color,
          fillOpacity: 0.85,
        }).bindPopup(`
          <div style="text-align:center;min-width:120px;">
            <b>${cp.name}</b><br>
            <span style="font-size:12px;">${t('rewardPts', { points: cp.pointValue })}</span><br>
            <span style="font-size:12px;font-weight:bold;color:${color};">
              ${isScanned ? '✓ ' + t('acquired') : '✗ ' + t('notScannedYet')}
            </span>
          </div>
        `).addTo(map.value)
        
        markers.value.push(marker)
      })

      // ── Completion detection ──────────────────────────────────────────────
      const totalCps = activeEvent.value.checkpoints.length
      const scannedCount = activeEvent.value.scannedCheckpointIds?.length ?? 0
      const nowDone = totalCps > 0 && scannedCount >= totalCps

      if (nowDone !== allDone.value) {
        // Status changed: reset dismiss so banner re-shows
        bannerDismissed.value = false
      }
      allDone.value = nowDone && !bannerDismissed.value

      // Gold user marker when finished
      if (userMarker.value) {
        if (nowDone) {
          userMarker.value.setStyle({ color: '#f9a825', fillColor: '#fdd835', fillOpacity: 1 })
        } else {
          userMarker.value.setStyle({ color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.9 })
        }
      }

      if (!initialMapFit) {
        setTimeout(() => {
          map.value.invalidateSize()
          const group = new L.featureGroup(markers.value)
          map.value.fitBounds(group.getBounds().pad(0.1), { maxZoom: 17 })
          initialMapFit = true
        }, 200)
      }
    }
  } catch (err) {
    console.error(err)
  }
}
</script>

<style scoped>
/* Locate me button */
.locate-btn {
  position: absolute;
  bottom: 24px;
  right: 16px;
  z-index: 1000;
}

/* GPS blocked overlay */
.gps-overlay {
  position: absolute;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.gps-card {
  background: #fff;
  border-radius: 20px;
  padding: 32px 28px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
.gps-icon { font-size: 3rem; margin-bottom: 12px; }
.gps-title { font-size: 1.2rem; font-weight: 800; color: #111; margin-bottom: 10px; }
.gps-body  { font-size: 0.92rem; color: #555; line-height: 1.5; }
.gps-hint  { font-size: 0.82rem; color: #888; margin-top: 10px; line-height: 1.5; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Completion banner */
.completion-banner {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  padding: 12px 16px 0;
  pointer-events: auto;
}
.banner-inner {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
  color: #fff;
  border-radius: 16px;
  padding: 16px 24px;
  text-align: center;
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  animation: bannerPulse 2s ease-in-out infinite;
  max-width: 340px;
  width: 100%;
}
.trophy { font-size: 2.5rem; margin-bottom: 4px; }
.banner-title { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; }
.banner-sub { font-size: 0.9rem; opacity: 0.9; margin-top: 4px; }
.banner-hint { font-size: 0.7rem; opacity: 0.55; margin-top: 8px; }

@keyframes bannerPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
  50%       { transform: scale(1.02); box-shadow: 0 8px 32px rgba(46,125,50,0.7); }
}

.slide-down-enter-active { animation: slideIn 0.4s ease; }
.slide-down-leave-active { animation: slideIn 0.3s ease reverse; }
@keyframes slideIn {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
</style>
