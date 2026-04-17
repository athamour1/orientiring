<template>
  <q-page class="relative-position" style="overflow: hidden;">
    <div id="map" class="absolute-full"></div>

    <!-- Transparent spinner overlay until event data loads -->
    <transition name="fade">
      <div v-if="!mapReady" class="absolute-full map-loading-overlay">
        <q-spinner-orbit color="primary" size="48px" />
      </div>
    </transition>

    <!-- Completion Banner — above footer -->
    <transition name="slide-up">
      <div v-if="allDone && !bannerDismissed" class="completion-banner">
        <div class="banner-inner">
          <div class="banner-left">
            <span class="trophy">{{ timeExpired ? '⏰' : '🏁' }}</span>
            <div>
              <div class="banner-title">{{ timeExpired ? $t('timeUp') : $t('allCheckpointsDone') }}</div>
              <div class="banner-sub">{{ $t('followReturnPoint') }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" color="white" size="sm" @click.stop="bannerDismissed = true" />
        </div>
      </div>
    </transition>

    <!-- Zoom controls -->
    <div class="zoom-btns">
      <q-btn round elevated icon="add" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="sm" @click="map.zoomIn()" />
      <q-btn round elevated icon="remove" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="sm" @click="map.zoomOut()" />
    </div>

    <!-- Layer picker -->
    <q-btn round elevated icon="layers" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="md" class="layer-btn shadow-4">
      <q-menu anchor="bottom right" self="top right" :offset="[0, 8]" class="layer-menu">
        <q-list dense style="min-width:160px; padding: 6px;">
          <q-item
            v-for="layer in baseLayers"
            :key="layer.name"
            clickable
            @click="switchBase(layer)"
            v-close-popup
            :class="['layer-item', { 'layer-item--active': activeBaseName === layer.name }]"
          >
            <q-item-section>{{ layer.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- Locate me button -->
    <q-btn
      round unelevated
      icon="my_location"
      :color="followMode ? 'primary' : ($q.dark.isActive ? 'dark' : 'white')"
      :text-color="followMode ? 'white' : 'primary'"
      size="md"
      class="locate-btn shadow-4"
      :disable="!gpsReady"
      @click="locateMe"
    />

    <!-- iOS compass permission banner -->
    <transition name="slide-up">
      <div v-if="showCompassPrompt" class="compass-banner">
        <div class="compass-banner-inner" @click="requestCompass">
          <span class="compass-icon">🧭</span>
          <div class="compass-text">
            <div class="compass-title">{{ $t('enableCompass') }}</div>
            <div class="compass-sub">{{ $t('enableCompassHint') }}</div>
          </div>
          <q-icon name="touch_app" color="white" size="24px" />
        </div>
      </div>
    </transition>

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
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useTeamEventStore } from 'src/stores/teamEvent'
const $q = useQuasar()
const router = useRouter()
const teamEventStore = useTeamEventStore()
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { socket, connectSocket } from 'src/boot/socket'

const map = ref(null)
const { t, locale } = useI18n()
const markers = ref([])
const activeEvent = ref(null)
const userMarker = ref(null)
const heading = ref(null) // device compass heading in degrees
const mapReady = ref(false)
const allDone = ref(false)
const timeExpired = ref(false)
const bannerDismissed = ref(false)
const gpsBlocked = ref(false)
const gpsPermissionDenied = ref(false)
const gpsRetrying = ref(false)
const followMode = ref(false)
const gpsReady = ref(false)
const showCompassPrompt = ref(false)
const activeBaseName = ref('street')
const baseLayers = ref([])
let currentBaseTile = null
let handleOrientation = null // compass handler — hoisted for cleanup

function switchBase(layer) {
  if (!map.value || !layer) return
  if (currentBaseTile) map.value.removeLayer(currentBaseTile)
  layer.tile.addTo(map.value)
  currentBaseTile = layer.tile
  activeBaseName.value = layer.name
  localStorage.setItem('mapLayer', layer.name)
}
let watchId = null
let endTimeTimeout = null
let initialMapFit = false
let lastSentLat = null
let lastSentLng = null
let lastSentTime = 0

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
    attribution: '© CartoDB',
    className: 'dark-tiles'
  })

  baseLayers.value = [
    { name: 'street',    label: '🗺️ Street',      tile: street },
    { name: 'topo',      label: '⛰️ Topographic', tile: topo },
    { name: 'satellite', label: '🛰️ Satellite',   tile: satellite },
    { name: 'dark',      label: '🌙 Dark',         tile: dark },
  ]

  const initialName = localStorage.getItem('mapLayer') || 'topo'
  activeBaseName.value = initialName
  const initialLayer = baseLayers.value.find(l => l.name === initialName).tile

  currentBaseTile = initialLayer
  map.value = L.map('map', { center: [0, 0], zoom: 2, layers: [initialLayer], zoomControl: false })

  // Disarm follow mode when the user manually drags or zooms
  map.value.on('dragstart', () => { followMode.value = false })
  map.value.on('zoomstart', (e) => { if (e.originalEvent) followMode.value = false })


  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  // Ensure shared socket is connected
  connectSocket()

  await fetchEvent()

  // Listen for event state changes via WS instead of polling
  if (teamEventStore.eventId) {
    const eid = Number(teamEventStore.eventId)
    socket.emit('join', eid)
    socket.on('event:ended', onEventStateChange)
    socket.on('event:activated', onEventStateChange)

    // On reconnect: re-join event room and resync state
    socket.on('connect', onReconnect)
  }

  // Always track GPS — admin needs location data even when showTeamLocation is off
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, { enableHighAccuracy: true })
  } else {
    gpsBlocked.value = true
    gpsPermissionDenied.value = false
  }

  // Track compass heading for direction arrow.
  // iOS: webkitCompassHeading is always absolute true-north (0=N, 90=E).
  // Android: 'deviceorientationabsolute' gives magnetic-north absolute readings.
  //   alpha increases counter-clockwise, so bearing = (360 - alpha) % 360.
  // Fallback 'deviceorientation' on Android has alpha relative to device start → unreliable.
  handleOrientation = (e) => {
    if (e.webkitCompassHeading != null) {
      // iOS — already a clockwise bearing from true north
      heading.value = e.webkitCompassHeading
    } else if (e.alpha != null) {
      // Android absolute: alpha is CCW from magnetic north → convert to CW bearing
      heading.value = (360 - e.alpha) % 360
    }
    updateUserMarkerIcon()
  }

  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ — requestPermission() must be called from a user gesture.
      // Check if already granted (e.g. from a previous session).
      try {
        const state = await DeviceOrientationEvent.requestPermission()
        if (state === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation)
        } else {
          showCompassPrompt.value = true
        }
      } catch {
        // Not inside a user gesture context — expected on first load.
        // Show banner so the user can tap to grant permission.
        showCompassPrompt.value = true
      }
    } else {
      // Android: prefer 'deviceorientationabsolute' (magnetic north reference).
      // Falls back to 'deviceorientation' if not supported.
      window.addEventListener('deviceorientationabsolute', handleOrientation)
      window.addEventListener('deviceorientation', (e) => {
        // Only use relative event if we haven't already received an absolute one
        if (heading.value === null) handleOrientation(e)
      })
    }
  }
})

function makeUserIcon(deg) {
  const showArrow = activeEvent.value?.showDirectionArrow
  const rotate = deg ?? 0
  const hasHeading = deg != null
  const arrowOpacity = hasHeading ? '1' : '0.7'
  // Arrow SVG is 24×24, dot is 16×16. Total canvas when arrow shown: 56×56
  // Dot sits at center (28,28). Arrow tip points up at 0°, rotated around dot center.
  const canvasSize = showArrow ? 56 : 22
  const dotSize = 16
  const half = canvasSize / 2

  return L.divIcon({
    className: '',
    iconSize: [canvasSize, canvasSize],
    iconAnchor: [half, half],
    html: `
      <div style="position:relative;width:${canvasSize}px;height:${canvasSize}px;">
        ${showArrow ? `
        <svg style="position:absolute;top:0;left:0;" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" overflow="visible">
          <g transform="rotate(${rotate}, ${half}, ${half})">
            <g transform="translate(${half - 12}, ${half - 28})">
              <path d="M4.47046 17.0591L10.2111 5.57771C10.9482 4.10361 13.0518 4.10362 13.7889 5.57771L19.5295 17.0591C20.3661 18.7322 18.6528 20.5356 16.9391 19.7858L12.4008 17.8004C12.1453 17.6886 11.8547 17.6886 11.5992 17.8004L7.06094 19.7858C5.34719 20.5356 3.6339 18.7322 4.47046 17.0591Z"
                stroke="#c4a0f5"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="#8d5adc"
                opacity="${arrowOpacity}"/>
            </g>
          </g>
        </svg>` : ''}
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:#8e5add;border:2.5px solid #6c3fc4;box-shadow:0 0 0 2px rgba(142,90,221,0.35);"></div>
      </div>`,
  })
}

function updateUserMarkerIcon() {
  if (userMarker.value) {
    userMarker.value.setIcon(makeUserIcon(heading.value))
  }
}

async function requestCompass() {
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') return
  try {
    const state = await DeviceOrientationEvent.requestPermission()
    if (state === 'granted') {
      window.addEventListener('deviceorientation', handleOrientation)
      showCompassPrompt.value = false
    }
  } catch (err) {
    console.warn('Compass permission denied', err)
  }
}

async function onPosition(pos) {
  const { latitude, longitude } = pos.coords

  // Follow mode — keep map centred on the team
  if (followMode.value && map.value) {
    map.value.panTo([latitude, longitude], { animate: true, duration: 0.5 })
  }

  // Only show team's own dot on their map if admin hasn't hidden locations
  if (activeEvent.value?.showTeamLocation !== false) {
    if (!userMarker.value) {
      userMarker.value = L.marker([latitude, longitude], { icon: makeUserIcon(heading.value) })
        .bindPopup('<b>📍 ' + t('yourTeam') + '</b>').addTo(map.value)
      if (markers.value.length === 0) {
        map.value.setView([latitude, longitude], 16)
      }
    } else {
      userMarker.value.setLatLng([latitude, longitude])
      userMarker.value.setIcon(makeUserIcon(heading.value))
      userMarker.value.bringToFront()
    }
  }

  const now = Date.now()
  const movedEnough = lastSentLat === null ||
    haversineMetres(lastSentLat, lastSentLng, latitude, longitude) > 10
  const enoughTime = now - lastSentTime > 4000
  if (movedEnough || enoughTime) {
    gpsReady.value = true
    socket.emit('location:update', { latitude, longitude })
    lastSentLat = latitude
    lastSentLng = longitude
    lastSentTime = now
  }
}

// Named handlers for proper cleanup
const onEventStateChange = () => fetchEvent()
const onReconnect = () => {
  if (teamEventStore.eventId) {
    socket.emit('join', Number(teamEventStore.eventId))
  }
  fetchEvent()
}

onUnmounted(() => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  if (endTimeTimeout) clearTimeout(endTimeTimeout)

  // Clean up socket listeners and leave room (don't disconnect — shared singleton)
  if (teamEventStore.eventId) {
    socket.emit('leave', Number(teamEventStore.eventId))
  }
  socket.off('event:ended', onEventStateChange)
  socket.off('event:activated', onEventStateChange)
  socket.off('connect', onReconnect)
})

const fetchEvent = async () => {
  try {
    const res = await api.get('/team/events/active')
    activeEvent.value = res.data
    teamEventStore.startTime = res.data?.startTime ?? null
    teamEventStore.endTime = res.data?.endTime ?? null
    teamEventStore.eventStatus = res.data?.status ?? null
    teamEventStore.eventId = res.data?.id ?? null
    teamEventStore.eventName = res.data?.name ?? null
    teamEventStore.eventDescription = res.data?.description ?? null

    // Redirect to lobby if event hasn't started yet
    if (res.data?.status === 'pending') {
      router.replace('/team/lobby')
      return
    }

    mapReady.value = true

    // Apply language set by the admin for this event
    if (res.data?.language) {
      locale.value = res.data.language
    }

    // showTeamLocation only controls visibility of the team's own dot on their map
    // GPS is always sent to the server so the admin can always track teams
    if (userMarker.value) {
      if (activeEvent.value?.showTeamLocation === false) {
        map.value?.removeLayer(userMarker.value)
        userMarker.value = null
      } else {
        // Refresh icon in case showDirectionArrow was toggled by admin
        updateUserMarkerIcon()
      }
    }

    if (!activeEvent.value || activeEvent.value === '') {
      return
    }

    if (activeEvent.value.checkpoints && activeEvent.value.checkpoints.length > 0) {
      // ── Completion detection ──────────────────────────────────────────────
      const totalCps = activeEvent.value.checkpoints.length
      const scannedCount = activeEvent.value.scannedCheckpointIds?.length ?? 0
      const eventExpired = !!(activeEvent.value.endTime && Date.now() > new Date(activeEvent.value.endTime).getTime())
      const nowDone = (totalCps > 0 && scannedCount >= totalCps) || eventExpired
      timeExpired.value = eventExpired && scannedCount < totalCps

      if (nowDone && !allDone.value) {
        bannerDismissed.value = false
      }
      allDone.value = nowDone
      teamEventStore.allDone = nowDone

      // Clear old markers
      markers.value.forEach(m => map.value?.removeLayer(m))
      markers.value = []

      if (nowDone) {
        // Show only the return point
        const retLat = activeEvent.value.returnSameAsStart ? activeEvent.value.startLat : activeEvent.value.returnLat
        const retLng = activeEvent.value.returnSameAsStart ? activeEvent.value.startLng : activeEvent.value.returnLng
        if (retLat && retLng) {
          const flagIcon = L.divIcon({
            className: '',
            html: '<div style="width:40px;height:40px;border-radius:50%;background:var(--q-positive);display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:3px solid #fff;">🏁</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
          const retMarker = L.marker([retLat, retLng], { icon: flagIcon })
            .bindPopup(`<div style="text-align:center;"><b>🏁 ${t('returnPoint')}</b><br><span style="font-size:12px;">${t('headBackToStart')}</span></div>`)
            .addTo(map.value)
          markers.value.push(retMarker)
          map.value.setView([retLat, retLng], 16, { animate: true })
        }
      } else {
        activeEvent.value.checkpoints.forEach(cp => {
          const isScanned = activeEvent.value.scannedCheckpointIds?.includes(cp.id)
          const color = isScanned ? '#43a047' : '#e53935'
          const marker = L.circleMarker([cp.latitude, cp.longitude], {
            radius: 11, weight: 3,
            color: isScanned ? '#2e7d32' : '#b71c1c',
            fillColor: color, fillOpacity: 0.85,
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
      }

      // Keep user marker always blue
      if (userMarker.value) {
        userMarker.value.setStyle({ color: '#6c3fc4', fillColor: '#8e5add', fillOpacity: 0.9 })
      }

      // Keep GPS dot on top of checkpoint markers
      if (userMarker.value) userMarker.value.bringToFront()

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

// When endTime is set/changed, schedule a one-shot fetchEvent to fire exactly
// when the timer expires so the map switches to "done" state immediately.
watch(() => teamEventStore.endTime, (val) => {
  if (endTimeTimeout) clearTimeout(endTimeTimeout)
  if (!val) return
  const ms = new Date(val).getTime() - Date.now()
  if (ms > 0) {
    endTimeTimeout = setTimeout(() => fetchEvent(), ms + 1000)
  } else {
    fetchEvent()
  }
}, { immediate: true })
</script>

<style scoped>
/* Map control buttons */
.zoom-btns {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.layer-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
}
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

.map-loading-overlay {
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

/* Completion banner — sits just above the bottom tab bar (58px) */
.completion-banner {
  position: absolute;
  bottom: 66px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  pointer-events: auto;
}
.banner-inner {
  background: linear-gradient(135deg, var(--q-positive), color-mix(in srgb, var(--q-positive) 70%, #fff));
  color: #fff;
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.banner-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.trophy { font-size: 2rem; line-height: 1; flex-shrink: 0; }
.banner-title { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.banner-sub { font-size: 0.8rem; opacity: 0.9; margin-top: 3px; font-weight: 500; line-height: 1.3; }


/* iOS compass permission banner */
.compass-banner {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: auto;
  width: calc(100% - 120px);
  max-width: 340px;
}
.compass-banner-inner {
  background: linear-gradient(135deg, #8e5add, #6c3fc4);
  color: #fff;
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.compass-banner-inner:active { opacity: 0.85; }
.compass-icon { font-size: 1.6rem; line-height: 1; flex-shrink: 0; }
.compass-text { flex: 1; min-width: 0; }
.compass-title { font-size: 0.92rem; font-weight: 700; line-height: 1.2; }
.compass-sub { font-size: 0.78rem; opacity: 0.85; margin-top: 2px; line-height: 1.3; }

.slide-up-enter-active { transition: transform 0.35s ease, opacity 0.35s ease; }
.slide-up-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.slide-up-enter-from  { transform: translateY(40px); opacity: 0; }
.slide-up-leave-to    { transform: translateY(40px); opacity: 0; }
</style>
