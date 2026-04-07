<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat round icon="arrow_back" color="grey-8" @click="$router.back()" class="q-mr-sm" />
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('liveActivityFeed') }}</div>
      <q-space />
      <q-btn flat round color="primary" icon="refresh" @click="fetchAll" :loading="loading" />
    </div>

    <!-- Live Map -->
    <q-card flat bordered class="shadow-2 q-mb-md overflow-hidden" style="border-radius: 12px;">
      <q-card-section class="q-pa-sm row items-center">
        <q-icon name="map" color="primary" class="q-mr-sm" />
        <span class="text-subtitle2 text-weight-bold">{{ $t('checkpointProgMap') }}</span>
        <q-space />
        <q-badge color="green" label="Live" class="q-pa-xs" />
      </q-card-section>
      <div id="admin-live-map" style="height: 380px; width: 100%;"></div>
    </q-card>

    <!-- Map Legend -->
    <q-card flat bordered class="shadow-1 q-mb-lg q-pa-sm">
      <div class="row q-gutter-md items-center justify-center text-caption text-grey-8">
        <div class="row items-center q-gutter-xs">
          <div style="width:14px;height:14px;border-radius:50%;background:#e53935;"></div>
          <span>{{ $t('notStarted') }}</span>
        </div>
        <div class="row items-center q-gutter-xs">
          <div style="width:14px;height:14px;border-radius:50%;background:#fb8c00;"></div>
          <span>{{ $t('inProgress') }}</span>
        </div>
        <div class="row items-center q-gutter-xs">
          <div style="width:14px;height:14px;border-radius:50%;background:#43a047;"></div>
          <span>{{ $t('allTeamsPassed') }}</span>
        </div>
      </div>
    </q-card>

    <!-- Team filter + timeline -->
    <q-card flat bordered class="q-pa-md shadow-2">
      <!-- Filter bar -->
      <div class="row items-center q-gutter-sm q-mb-md">
        <q-icon name="filter_list" color="grey-7" />
        <span class="text-caption text-grey-7">{{ $t('filterByTeam') }}:</span>
        <q-btn
          v-for="team in allTeams"
          :key="team.id"
          :label="team.username"
          :outline="selectedTeamId !== team.id"
          :unelevated="selectedTeamId === team.id"
          size="sm"
          no-caps
          :color="teamColor(team.id)"
          @click="toggleTeam(team.id)"
          class="q-px-sm"
        >
          <q-tooltip>{{ $t('showRouteTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="selectedTeamId !== null"
          flat dense round icon="close" size="sm" color="grey-7"
          @click="selectedTeamId = null; routeLayer.clearLayers(); renderTeams(lastLocations)"
        >
          <q-tooltip>{{ $t('showAllTeams') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- Route hint -->
      <div v-if="selectedTeamId === null && allTeams.length > 0" class="text-caption text-grey-6 q-mb-sm row items-center q-gutter-xs">
        <q-icon name="info" size="14px" />
        <span>{{ $t('routeHint') }}</span>
      </div>
      <div v-if="selectedTeamId !== null" class="text-caption text-grey-7 q-mb-sm row items-center q-gutter-xs">
        <q-icon name="route" size="14px" :color="teamColor(selectedTeamId)" />
        <span>{{ $t('viewingRouteFor', { team: allTeams.find(t => t.id === selectedTeamId)?.username }) }}</span>
      </div>

      <div v-if="filteredLogs.length === 0" class="text-center text-grey-7 q-py-xl">
        <q-icon name="history" size="3rem" class="q-mb-sm opacity-50" />
        <div>{{ $t('noActivity') }}</div>
      </div>

      <q-timeline v-else color="primary">
        <q-timeline-entry
          v-for="log in filteredLogs"
          :key="log.id"
          :title="log.team.username"
          :subtitle="new Date(log.scannedAt).toLocaleString()"
          icon="qr_code_scanner"
          :color="teamColor(log.team.id)"
        >
          <div>
            {{ $t('captured') }} <b>{{ log.checkpoint.name }}</b>
            <q-badge color="positive" class="q-ml-xs">+{{ log.checkpoint.pointValue }} {{ $t('pts') }}</q-badge>
          </div>
        </q-timeline-entry>
      </q-timeline>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AntPath } from 'leaflet-ant-path'
import { useEventSocket } from 'src/composables/useEventSocket'

const route = useRoute()
const $q = useQuasar()
const { t } = useI18n()
const eventId = route.params.eventId
const logs = ref([])
const loading = ref(false)
const selectedTeamId = ref(null)
let map = null
let hasFit = false
const checkpointLayer = L.layerGroup()
const teamLayer = L.layerGroup()
const routeLayer = L.layerGroup()

// Team colours — consistent by team id
const TEAM_COLORS = ['primary', 'purple', 'teal', 'deep-orange', 'red', 'brown']
const TEAM_HEX    = ['#1565C0', '#6a1b9a', '#00695c', '#e65100', '#b71c1c', '#4e342e']

// Build a stable index map so team colours don't shift as new teams appear
const teamIndexMap = new Map()
function teamColor(id) {
  if (!teamIndexMap.has(id)) teamIndexMap.set(id, teamIndexMap.size)
  return TEAM_COLORS[teamIndexMap.get(id) % TEAM_COLORS.length]
}
function teamHex(id) {
  if (!teamIndexMap.has(id)) teamIndexMap.set(id, teamIndexMap.size)
  return TEAM_HEX[teamIndexMap.get(id) % TEAM_HEX.length]
}

// Unique teams extracted from logs
const allTeams = ref([])

const filteredLogs = computed(() =>
  selectedTeamId.value === null
    ? logs.value
    : logs.value.filter(l => l.team.id === selectedTeamId.value)
)

async function toggleTeam(id) {
  selectedTeamId.value = selectedTeamId.value === id ? null : id
  renderTeams(lastLocations)
  await renderRoute()
}

// ─── SVG Arc Ring helpers ──────────────────────────────────────────────────
function buildArcSvg(filled, total) {
  const R = 20, r = 12, cx = 26, cy = 26, size = 52

  if (total === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="#bbb" stroke-width="${R-r}" />
    </svg>`
  }

  const allDone = filled >= total
  const paths = []
  const gap = 0.05

  for (let i = 0; i < total; i++) {
    const startAngle = (2 * Math.PI * i) / total - Math.PI / 2 + gap / 2
    const endAngle   = (2 * Math.PI * (i + 1)) / total - Math.PI / 2 - gap / 2
    const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle),   y2 = cy + R * Math.sin(endAngle)
    const x3 = cx + r * Math.cos(endAngle),   y3 = cy + r * Math.sin(endAngle)
    const x4 = cx + r * Math.cos(startAngle), y4 = cy + r * Math.sin(startAngle)
    const large = (endAngle - startAngle) > Math.PI ? 1 : 0
    const color = allDone ? '#43a047' : (i < filled ? '#fb8c00' : '#e53935')
    paths.push(`<path d="M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z" fill="${color}" stroke="#fff" stroke-width="0.5"/>`)
  }

  paths.push(`<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="white" opacity="0.92"/>`)
  paths.push(`<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="bold" fill="#111" font-family="sans-serif">${filled}/${total}</text>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${paths.join('')}</svg>`
}

function makeRingIcon(filled, total) {
  const svg = buildArcSvg(filled, total)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  return L.icon({ iconUrl: url, iconSize: [52, 52], iconAnchor: [26, 26], popupAnchor: [0, -26] })
}

// ─── Route polyline ───────────────────────────────────────────────────────
let activePolyline = null
let latestMarker = null

async function renderRoute() {
  routeLayer.clearLayers()
  activePolyline = null
  latestMarker = null
  if (!map || selectedTeamId.value === null) return
  try {
    const res = await api.get(`/admin/events/${eventId}/teams/${selectedTeamId.value}/route`)
    const points = res.data
    if (points.length < 1) return
    const latlngs = points.map(p => [p.latitude, p.longitude])
    const color = teamHex(selectedTeamId.value)

    if (latlngs.length >= 2) {
      activePolyline = new AntPath(latlngs, { color, weight: 3, opacity: 0.75, delay: 800, dashArray: [10, 20], pulseColor: '#fff' })
      routeLayer.addLayer(activePolyline)
      L.circleMarker(latlngs[0], { radius: 6, color, fillColor: '#fff', fillOpacity: 1, weight: 2 })
        .bindTooltip('▶ Start', { permanent: false }).addTo(routeLayer)
    }

    latestMarker = L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, color, fillColor: color, fillOpacity: 1, weight: 2 })
      .bindTooltip('⬛ Latest', { permanent: false })
    routeLayer.addLayer(latestMarker)
  } catch {
    // Route unavailable — silently skip
  }
}

function extendRoute(teamId, latitude, longitude) {
  if (selectedTeamId.value !== teamId || !map) return
  const latlng = [latitude, longitude]
  const color = teamHex(teamId)

  if (activePolyline) {
    activePolyline.addLatLng(latlng)
  } else {
    // First point — create the polyline now that we have 2 points
    // (latestMarker holds the previous single point if any)
    if (latestMarker) {
      const prev = latestMarker.getLatLng()
      activePolyline = new AntPath([prev, latlng], { color, weight: 3, opacity: 0.75, delay: 800, dashArray: [10, 20], pulseColor: '#fff' })
      routeLayer.addLayer(activePolyline)
      // Retroactively add start marker
      L.circleMarker(prev, { radius: 6, color, fillColor: '#fff', fillOpacity: 1, weight: 2 })
        .bindTooltip('▶ Start', { permanent: false }).addTo(routeLayer)
    }
  }

  // Move the "latest" marker to the new position
  if (latestMarker) {
    latestMarker.setLatLng(latlng)
  } else {
    latestMarker = L.circleMarker(latlng, { radius: 6, color, fillColor: color, fillOpacity: 1, weight: 2 })
      .bindTooltip('⬛ Latest', { permanent: false })
    routeLayer.addLayer(latestMarker)
  }
}

// ─── fetch & render ────────────────────────────────────────────────────────
let lastLocations = []

const fetchAll = async () => {
  loading.value = true
  try {
    const [logsRes, statsRes, locRes, teamsRes] = await Promise.all([
      api.get(`/admin/events/${eventId}/logs`),
      api.get(`/admin/events/${eventId}/stats`),
      api.get(`/admin/events/${eventId}/team-locations`),
      api.get(`/admin/events/${eventId}/teams`),
    ])
    logs.value = logsRes.data
    lastLocations = locRes.data
    allTeams.value = teamsRes.data.map(t => ({ id: t.id, username: t.username }))
    renderCheckpoints(statsRes.data)
    renderTeams(locRes.data)
  } catch {
    // Polling failure — next interval will retry
  }
  loading.value = false
}

function renderCheckpoints(stats) {
  if (!map || !stats) return
  checkpointLayer.clearLayers()
  const { checkpoints, teamCount } = stats
  const latlngs = []

  checkpoints.forEach(cp => {
    const filled = cp._count.scans
    const icon = makeRingIcon(filled, teamCount)
    const marker = L.marker([cp.latitude, cp.longitude], { icon })
      .bindTooltip(`<b>${cp.name}</b>`, { permanent: false, direction: 'top', offset: [0, -26], opacity: 0.95 })
      .bindPopup(`
        <div style="min-width:130px; text-align:center;">
          <b>${cp.name}</b><br>
          <span style="font-size:12px;">${t('teamsScanned', { count: filled, total: teamCount })}</span><br>
          <span style="font-size:11px; color:#888;">${t('ptsEach', { points: cp.pointValue })}</span>
        </div>
      `)
    checkpointLayer.addLayer(marker)
    latlngs.push([cp.latitude, cp.longitude])
  })

  if (latlngs.length > 0 && !hasFit) {
    map.fitBounds(L.latLngBounds(latlngs).pad(0.2))
    hasFit = true
  }
}

function renderTeams(locations) {
  if (!map) return
  teamLayer.clearLayers()

  const visible = selectedTeamId.value === null
    ? locations
    : locations.filter(l => l.team.id === selectedTeamId.value)

  visible.forEach(loc => {
    const color = teamHex(loc.team.id)
    const isSelected = loc.team.id === selectedTeamId.value
    const dot = L.circleMarker([loc.latitude, loc.longitude], {
      radius: isSelected ? 11 : 9,
      color: '#fff',
      weight: isSelected ? 3 : 2,
      fillColor: color,
      fillOpacity: 0.9,
      pane: isSelected ? 'selectedTeamPane' : 'overlayPane',
    })
      .bindTooltip(`<b style="color:${color};">${loc.team.username}</b>`, {
        permanent: false, direction: 'top', offset: [0, -10], opacity: 0.95,
      })
      .bindPopup(`
        <div style="text-align:center;">
          <b style="color:${color};">📍 ${loc.team.username}</b><br>
          <span style="font-size:11px;color:#888;">${t('lastUpdated')} ${new Date(loc.updatedAt).toLocaleTimeString()}</span>
        </div>
      `)
    teamLayer.addLayer(dot)
  })
}

onMounted(async () => {
  await nextTick()

  map = L.map('admin-live-map', { center: [0, 0], zoom: 2 })
  const pane = map.createPane('selectedTeamPane')
  pane.style.zIndex = 650

  const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
  const topoTile = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' })
  const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' })
  const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB' })

  let activeBase = $q.dark.isActive ? darkTile : streetTile
  activeBase.addTo(map)

  L.control.layers(
    { '🌙 Dark': darkTile, '🗺️ Street': streetTile, '⛰️ Topographic': topoTile, '🛰️ Satellite': satelliteTile },
    { '📍 Teams': teamLayer, '🎯 Checkpoints': checkpointLayer, '🛤️ Route': routeLayer }
  ).addTo(map)

  watch(() => $q.dark.isActive, (isDark) => {
    const next = isDark ? darkTile : streetTile
    map.removeLayer(activeBase)
    next.addTo(map)
    activeBase = next
  })

  checkpointLayer.addTo(map)
  teamLayer.addTo(map)
  routeLayer.addTo(map)

  setTimeout(() => map.invalidateSize(), 150)

  // Initial load via REST
  await fetchAll()

  // Live updates via WebSocket — no polling needed
  const socket = useEventSocket(eventId)

  socket.on('scan:created', (payload) => {
    logs.value.unshift({
      id: Date.now(),
      team: { id: payload.teamId, username: payload.teamUsername },
      checkpoint: { id: payload.checkpointId, name: payload.checkpointName, pointValue: payload.points - payload.bonusAwarded },
      scannedAt: payload.scannedAt,
    })
    // Ensure the team is in the filter list even if they weren't registered at load time
    if (!allTeams.value.find(t => t.id === payload.teamId)) {
      allTeams.value.push({ id: payload.teamId, username: payload.teamUsername })
    }
  })

  socket.on('stats:updated', (payload) => {
    renderCheckpoints({ checkpoints: payload.checkpoints, teamCount: payload.teamCount })
  })

  socket.on('location:updated', (payload) => {
    // Patch the location in our cached list and re-render team dot
    const idx = lastLocations.findIndex(l => l.team.id === payload.teamId)
    const entry = { latitude: payload.latitude, longitude: payload.longitude, updatedAt: new Date().toISOString(), team: { id: payload.teamId, username: payload.teamUsername } }
    if (idx >= 0) lastLocations[idx] = entry
    else lastLocations.push(entry)
    renderTeams(lastLocations)
    // Extend the route polyline live if this team is selected
    extendRoute(payload.teamId, payload.latitude, payload.longitude)
  })
})

onUnmounted(() => {
  if (map) { map.remove(); map = null }
})
</script>

<style scoped>
.tracking-tight { letter-spacing: -0.02em; }
.opacity-50 { opacity: 0.5; }
</style>
