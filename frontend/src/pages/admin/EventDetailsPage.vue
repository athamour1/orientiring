<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('checkpoints') }}</div>
      <q-space />
      <q-btn color="primary" icon="place" :label="$t('addCheckpoint')" unelevated no-caps @click="showDialog = true" />
    </div>

    <!-- Map Preview -->
    <q-card flat bordered class="shadow-2 q-mb-lg overflow-hidden" style="border-radius:14px; position: relative;">
      <div id="admin-map" style="height: 320px; width: 100%;"></div>
      <div class="admin-zoom-btns">
        <q-btn round elevated color="white" text-color="dark" icon="add" size="sm" @click="map && map.zoomIn()" />
        <q-btn round elevated color="white" text-color="dark" icon="remove" size="sm" @click="map && map.zoomOut()" />
      </div>
      <div class="admin-layer-btn">
        <q-btn round elevated icon="layers" color="white" text-color="grey-8" size="sm">
          <q-menu anchor="top right" self="bottom right" :offset="[0, 8]" class="layer-menu">
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
      </div>
    </q-card>

    <!-- Checkpoints Table -->
    <q-card flat bordered class="shadow-2">
      <q-table :rows="checkpoints" :columns="columns" row-key="id" flat class="admin-table">
        <template v-slot:top-right>
          <q-btn color="secondary" icon="archive" :label="$t('downloadAllQr')" unelevated no-caps @click="downloadAllQr" v-if="checkpoints.length > 0" />
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round color="primary" dense icon="qr_code" @click="openQrPreview(props.row)">
              <q-tooltip>{{ $t('viewQrCode') }}</q-tooltip>
            </q-btn>
            <q-btn flat round color="negative" dense icon="delete" class="q-ml-sm" @click="confirmDelete(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Add Checkpoint Modal -->
    <q-dialog v-model="showDialog">
      <q-card style="min-width: 380px" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('deployCheckpoint') }}</div>
          <div class="text-caption text-grey-7">{{ $t('whereNavigate') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-form @submit="createCheckpoint" class="q-gutter-md">
            <q-input v-model="form.name" :label="$t('locationName')" outlined :rules="[val => !!val || 'Required']" />
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input v-model.number="form.latitude" :label="$t('latitude')" type="number" step="any" outlined :rules="[val => !!val || 'Required']" />
              </div>
              <div class="col-12 col-sm-6">
                <q-input v-model.number="form.longitude" :label="$t('longitude')" type="number" step="any" outlined :rules="[val => !!val || 'Required']" />
              </div>
            </div>
            <q-input v-model.number="form.pointValue" :label="$t('pointValueReward')" type="number" outlined :rules="[val => !!val || 'Required']" />
            <q-input v-model.number="form.bonusForFirst" :label="$t('bonusForFirst')" type="number" min="0" outlined :hint="$t('bonusForFirstHint')" />
            <q-btn flat color="secondary" icon="my_location" :label="$t('useGps')" @click="getCurrentLocation" class="full-width" no-caps />
            <div class="row justify-end q-mt-lg q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('deploy')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- QR Preview Modal -->
    <q-dialog v-model="previewDialog">
      <q-card style="min-width: 300px" class="q-pa-sm text-center">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ previewCp?.name }}</div>
          <div class="text-caption text-grey-7">{{ $t('checkpointQrCode') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none flex flex-center">
          <q-img :src="previewUrl" width="200px" height="200px" fit="contain" />
        </q-card-section>
        <q-card-actions align="center" class="q-pb-md">
          <q-btn flat :label="$t('close')" color="grey-7" v-close-popup no-caps />
          <q-btn unelevated icon="download" :label="$t('download')" color="primary" @click="downloadVisibleQr" no-caps />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const route = useRoute()
const $q = useQuasar()
const { t } = useI18n()
const eventId = route.params.eventId
const checkpoints = ref([])
const showDialog = ref(false)
const previewDialog = ref(false)
const previewCp = ref(null)
const previewUrl = ref('')
const form = ref({ name: '', latitude: null, longitude: null, pointValue: 10, bonusForFirst: 0 })
const baseLayers = ref([])
const activeBaseName = ref('street')
let currentBaseTile = null
let map = null

function switchBase(layer) {
  if (!map || !layer) return
  if (currentBaseTile) map.removeLayer(currentBaseTile)
  layer.tile.addTo(map)
  currentBaseTile = layer.tile
  activeBaseName.value = layer.name
}

const columns = computed(() => [
  { name: 'name', required: true, label: t('name'), align: 'left', field: 'name', sortable: true },
  { name: 'latitude', label: t('lat'), align: 'left', field: 'latitude' },
  { name: 'longitude', label: t('lng'), align: 'left', field: 'longitude' },
  { name: 'pointValue', label: 'Pts', align: 'center', field: 'pointValue', sortable: true },
  { name: 'actions', label: 'QR', align: 'right' }
])

onMounted(async () => {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })
  await nextTick()
  map = L.map('admin-map', { doubleClickZoom: false, zoomControl: false }).setView([0, 0], 2)

  const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
  const topoTile = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' })
  const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' })
  const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB', className: 'dark-tiles' })

  baseLayers.value = [
    { name: 'street',    label: '🗺️ Street',      tile: streetTile },
    { name: 'topo',      label: '⛰️ Topographic', tile: topoTile },
    { name: 'satellite', label: '🛰️ Satellite',   tile: satelliteTile },
    { name: 'dark',      label: '🌙 Dark',         tile: darkTile },
  ]

  const initName = $q.dark.isActive ? 'dark' : 'street'
  activeBaseName.value = initName
  currentBaseTile = baseLayers.value.find(l => l.name === initName).tile
  currentBaseTile.addTo(map)

  watch(() => $q.dark.isActive, (isDark) => {
    switchBase(baseLayers.value.find(l => l.name === (isDark ? 'dark' : 'street')))
  })
  map.on('dblclick', (e) => {
    form.value.latitude = Number(e.latlng.lat.toFixed(6))
    form.value.longitude = Number(e.latlng.lng.toFixed(6))
    showDialog.value = true
  })
  setTimeout(() => map.invalidateSize(), 100)
  fetchCheckpoints()
})

const fetchCheckpoints = async () => {
  try {
    const res = await api.get(`/admin/events/${eventId}/checkpoints`)
    checkpoints.value = res.data
    const markers = []
    checkpoints.value.forEach(cp => {
      const marker = L.marker([cp.latitude, cp.longitude]).bindPopup(`<b>${cp.name}</b>`).addTo(map)
      markers.push(marker)
    })
    if (markers.length > 0) {
      map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1))
    }
  } catch (err) { console.error(err) }
}

const getCurrentLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      form.value.latitude = pos.coords.latitude
      form.value.longitude = pos.coords.longitude
    }, (err) => { console.error(err) })
  }
}

const createCheckpoint = async () => {
  try {
    await api.post(`/admin/events/${eventId}/checkpoints`, form.value)
    showDialog.value = false
    form.value = { name: '', latitude: null, longitude: null, pointValue: 10, bonusForFirst: 0 }
    fetchCheckpoints()
  } catch (err) { console.error(err) }
}

const openQrPreview = async (cp) => {
  try {
    const res = await api.get(`/admin/events/${eventId}/checkpoints/${cp.id}/qr-code`, { responseType: 'blob' })
    previewUrl.value = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }))
    previewCp.value = cp
    previewDialog.value = true
  } catch (err) { console.error(err) }
}

const downloadVisibleQr = () => {
  const link = document.createElement('a')
  link.href = previewUrl.value
  link.setAttribute('download', `${previewCp.value.name.replace(/\s+/g, '_')}_QR.png`)
  document.body.appendChild(link)
  link.click()
}

const downloadAllQr = async () => {
  try {
    $q.loading.show({ message: 'Compiling Zip Archive...' })
    const zip = new JSZip()
    for (const cp of checkpoints.value) {
      const res = await api.get(`/admin/events/${eventId}/checkpoints/${cp.id}/qr-code`, { responseType: 'blob' })
      zip.file(`${cp.name.replace(/\s+/g, '_')}_QR.png`, res.data)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = window.URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Event_${eventId}_QRCodes.zip`)
    document.body.appendChild(link)
    link.click()
    $q.loading.hide()
  } catch {
    $q.loading.hide()
  }
}

const confirmDelete = (cp) => {
  $q.dialog({
    title: t('confirmDeletion'),
    message: `Are you sure you want to permanently delete checkpoint '${cp.name}'?`,
    ok: { color: 'negative', label: 'Delete', noCaps: true },
    cancel: { color: 'grey', noCaps: true, flat: true }
  }).onOk(async () => {
    try {
      await api.delete(`/admin/events/${eventId}/checkpoints/${cp.id}`)
      fetchCheckpoints()
    } catch (err) { console.error(err) }
  })
}
</script>

<style scoped>
.admin-page { max-width: 900px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
.admin-zoom-btns {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admin-layer-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
}
</style>
