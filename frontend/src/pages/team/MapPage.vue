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

const map = ref(null)
const $q = useQuasar()
const { t } = useI18n()
const markers = ref([])
const activeEvent = ref(null)
const userMarker = ref(null)
const allDone = ref(false)
const bannerDismissed = ref(false)
let watchId = null
let eventInterval = null
let initialMapFit = false
let lastSentLat = null
let lastSentLng = null
let lastSentTime = 0

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

  await fetchEvent()
  eventInterval = setInterval(fetchEvent, 5000)

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords
      
      if (!userMarker.value) {
        // Draw the user physically on the map
        userMarker.value = L.circleMarker([latitude, longitude], {
          color: '#21ba45', fillColor: '#21ba45', fillOpacity: 0.8, radius: 8
        }).bindPopup('<b>' + t('yourTeam') + '</b>').addTo(map.value)
        
        // Only force camera focus if absolutely no checkpoints exist
        if (markers.value.length === 0) {
          map.value.setView([latitude, longitude], 16)
        }
      } else {
        // Update user marker dynamically as they walk playing the game
        userMarker.value.setLatLng([latitude, longitude])
      }

      // Push position to backend only when moved >10m or >4s since last send
      const now = Date.now()
      const movedEnough = lastSentLat === null ||
        haversineMetres(lastSentLat, lastSentLng, latitude, longitude) > 10
      const enoughTime = now - lastSentTime > 4000
      if (movedEnough || enoughTime) {
        try {
          await api.put('/team/events/location', { latitude, longitude })
          lastSentLat = latitude
          lastSentLng = longitude
          lastSentTime = now
        } catch { /* silent — non-critical */ }
      }
      
    }, () => { /* GPS unavailable — user will see no location marker */ }, { enableHighAccuracy: true })
  }
})

onUnmounted(() => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  if (eventInterval) clearInterval(eventInterval)
})

const fetchEvent = async () => {
  try {
    const res = await api.get('/team/events/active')
    activeEvent.value = res.data

    if (!activeEvent.value || activeEvent.value === '') {
      return $q.notify({ color: 'warning', icon: 'warning', message: t('noActiveEvent') })
    }

    if (activeEvent.value.checkpoints && activeEvent.value.checkpoints.length > 0) {
      // Clear legacy markers from prior iterations
      markers.value.forEach(m => map.value?.removeLayer(m))
      markers.value = []

      activeEvent.value.checkpoints.forEach(cp => {
        const isScanned = activeEvent.value.scannedCheckpointIds?.includes(cp.id)
        
        const marker = L.circleMarker([cp.latitude, cp.longitude], {
          radius: 10,
          weight: 3,
          color: isScanned ? '#9e9e9e' : '#d32f2f',
          fillColor: isScanned ? '#bdbdbd' : '#f44336',
          fillOpacity: isScanned ? 0.3 : 0.8
        }).bindPopup(`
          <div class="text-center">
            <b>${cp.name}</b><br>
            <span class="text-caption">${t('rewardPts', { points: cp.pointValue })}</span><br>
            ${isScanned ? '<q-badge color="positive" class="q-mt-sm">' + t('acquired') + '</q-badge>' : ''}
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
        const doneColor = nowDone ? '#ffd600' : '#21ba45'
        userMarker.value.setStyle({ color: doneColor, fillColor: doneColor })
      }

      if (!initialMapFit) {
        setTimeout(() => {
          map.value.invalidateSize()
          const group = new L.featureGroup(markers.value)
          map.value.fitBounds(group.getBounds().pad(0.1), { maxZoom: 17 })
          initialMapFit = true
        }, 200)
      }
    } else {
      $q.notify({ color: 'info', icon: 'info', message: t('noTargetsYet') })
    }
  } catch {
    $q.notify({ color: 'negative', icon: 'error', message: t('failedToSync') })
  }
}
</script>

<style scoped>
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
