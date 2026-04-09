<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('checkpoints') }}</div>
      <q-space />
      <q-btn color="primary" icon="place" :label="$t('addCheckpoint')" unelevated no-caps @click="showDialog = true" />
    </div>

    <!-- Map Preview -->
    <q-card flat bordered class="shadow-2 q-mb-lg overflow-hidden" style="border-radius:14px; position: relative;">
      <div id="admin-map" style="height: 320px; width: 100%; position: relative;">
        <transition name="fade">
          <div v-if="!mapReady" style="position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
            <q-spinner-orbit color="primary" size="48px" />
          </div>
        </transition>
        <div class="admin-zoom-btns">
          <q-btn round elevated :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" icon="add" size="sm" @click="map && map.zoomIn()" />
          <q-btn round elevated :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" icon="remove" size="sm" @click="map && map.zoomOut()" />
        </div>
        <div class="admin-layer-btn">
          <q-btn round elevated icon="layers" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="sm">
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
        <div class="admin-locate-btn">
          <q-btn round elevated icon="my_location" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="sm" @click="locateOnMap(map)" />
        </div>
      </div>
    </q-card>

    <!-- Checkpoints Table -->
    <q-card flat bordered class="shadow-2">
      <q-table :rows="tableLoading ? skeletonRows : checkpoints" :columns="columns" row-key="id" flat class="admin-table">
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <q-skeleton v-if="tableLoading" type="text" />
              <template v-else-if="col.name === 'actions'">
                <q-btn flat round color="primary" dense icon="qr_code" @click="openQrPreview(props.row)"><q-tooltip>{{ $t('viewQrCode') }}</q-tooltip></q-btn>
                <q-btn flat round color="secondary" dense icon="edit" class="q-ml-xs" @click="openEditDialog(props.row)"><q-tooltip>{{ $t('edit') }}</q-tooltip></q-btn>
                <q-btn flat round color="negative" dense icon="delete" class="q-ml-xs" @click="confirmDelete(props.row)" />
              </template>
              <template v-else>{{ col.value }}</template>
            </q-td>
          </q-tr>
        </template>
        <template v-slot:top-right>
          <q-btn color="secondary" icon="archive" :label="$t('downloadAllQr')" unelevated no-caps @click="downloadAllQr" v-if="checkpoints.length > 0" />
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
            <div class="row q-gutter-sm">
              <q-input class="col" v-model.number="form.latitude" :label="$t('latitude')" type="number" step="any" outlined :rules="[val => !!val || 'Required']" />
              <q-input class="col" v-model.number="form.longitude" :label="$t('longitude')" type="number" step="any" outlined :rules="[val => !!val || 'Required']" />
            </div>
            <q-input v-model.number="form.pointValue" :label="$t('pointValueReward')" type="number" outlined :rules="[val => !!val || 'Required']" />
            <div>
              <q-toggle v-model="formBonusEnabled" :label="$t('bonusForFirst')" color="primary" @update:model-value="val => { if (!val) form.bonusForFirst = 0 }" />
              <q-input v-if="formBonusEnabled" v-model.number="form.bonusForFirst" :label="$t('bonusForFirst')" type="number" min="0" outlined :hint="$t('bonusForFirstHint')" class="q-mt-sm" />
            </div>
            <div class="row justify-end q-mt-lg q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('deploy')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Edit Checkpoint Modal -->
    <q-dialog v-model="editDialog" @hide="onEditDialogHide">
      <q-card style="min-width: 380px; width: 95vw; max-width: 520px;" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('editCheckpoint') }}</div>
          <div class="text-caption text-grey-7">{{ $t('editCheckpointDesc') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-form @submit="saveEdit" class="q-gutter-md">
            <q-input v-model="editForm.name" :label="$t('locationName')" outlined :rules="[val => !!val || 'Required']" />
            <div>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <q-input v-model.number="editForm.latitude" :label="$t('latitude')" type="number" step="any" outlined />
                </div>
                <div class="col-6">
                  <q-input v-model.number="editForm.longitude" :label="$t('longitude')" type="number" step="any" outlined />
                </div>
              </div>
            </div>
            <!-- Mini map -->
            <div style="position:relative; border-radius:10px; overflow:hidden; height:200px;">
              <div id="edit-map" style="height:200px; width:100%;"></div>
              <div class="edit-zoom-btns">
                <q-btn round elevated :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" icon="add" size="xs" @click="editMap && editMap.zoomIn()" />
                <q-btn round elevated :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" icon="remove" size="xs" @click="editMap && editMap.zoomOut()" />
              </div>
              <div class="edit-layer-btn">
                <q-btn round elevated icon="layers" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="xs">
                  <q-menu anchor="top right" self="bottom right" :offset="[0, 6]" class="layer-menu">
                    <q-list dense style="min-width:150px; padding: 4px;">
                      <q-item
                        v-for="layer in editBaseLayers"
                        :key="layer.name"
                        clickable
                        @click="switchEditBase(layer)"
                        v-close-popup
                        :class="['layer-item', { 'layer-item--active': editBaseName === layer.name }]"
                      >
                        <q-item-section>{{ layer.label }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
              <div class="edit-locate-btn">
                <q-btn round elevated icon="my_location" :color="$q.dark.isActive ? 'dark' : 'white'" text-color="primary" size="xs" @click="locateOnMap(editMap)" />
              </div>
              <div class="text-caption text-grey-6 edit-map-hint">{{ $t('clickMapToSet') }}</div>
            </div>
            <div>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <q-input v-model.number="editForm.pointValue" :label="$t('pointValueReward')" type="number" outlined :rules="[val => !!val || 'Required']" />
                </div>
                <div class="col-12">
                  <q-toggle v-model="editBonusEnabled" :label="$t('bonusForFirst')" color="primary" @update:model-value="val => { if (!val) editForm.bonusForFirst = 0 }" />
                  <q-input v-if="editBonusEnabled" v-model.number="editForm.bonusForFirst" :label="$t('bonusForFirst')" type="number" min="0" outlined class="q-mt-sm" />
                </div>
              </div>
            </div>
            <div class="row justify-end q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('saveChanges')" color="primary" type="submit" no-caps />
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
import { ref, onMounted, nextTick, computed } from 'vue'
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
const tableLoading = ref(true)
const mapReady = ref(false)
const skeletonRows = Array.from({ length: 5 }, (_, i) => ({ id: i }))
const showDialog = ref(false)
const previewDialog = ref(false)
const editDialog = ref(false)
const previewCp = ref(null)
const previewUrl = ref('')
const form = ref({ name: '', latitude: null, longitude: null, pointValue: 10, bonusForFirst: 0 })
const formBonusEnabled = ref(false)
const editForm = ref({ id: null, name: '', latitude: null, longitude: null, pointValue: 10, bonusForFirst: 0 })
const editBonusEnabled = ref(false)
const baseLayers = ref([])
const activeBaseName = ref('street')
let currentBaseTile = null
let map = null
let locationDot = null
let editMap = null
let editMarker = null
let editCurrentBaseTile = null
const editBaseLayers = ref([])
const editBaseName = ref('topo')

function switchEditBase(layer) {
  if (!editMap || !layer) return
  if (editCurrentBaseTile) editMap.removeLayer(editCurrentBaseTile)
  layer.tile.addTo(editMap)
  editCurrentBaseTile = layer.tile
  editBaseName.value = layer.name
  localStorage.setItem('adminMapLayer', layer.name)
}

function showLocationDot(mapInstance, lat, lng) {
  if (!mapInstance) return
  if (locationDot) mapInstance.removeLayer(locationDot)
  locationDot = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: '#1976d2',
    fillOpacity: 1,
    color: '#fff',
    weight: 3,
  }).addTo(mapInstance)
}

function locateOnMap(mapInstance) {
  if (!mapInstance || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(pos => {
    mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 16)
    showLocationDot(mapInstance, pos.coords.latitude, pos.coords.longitude)
  })
}

function switchBase(layer) {
  if (!map || !layer) return
  if (currentBaseTile) map.removeLayer(currentBaseTile)
  layer.tile.addTo(map)
  currentBaseTile = layer.tile
  activeBaseName.value = layer.name
  localStorage.setItem('adminMapLayer', layer.name)
}

const columns = computed(() => [
  { name: 'name', required: true, label: t('name'), align: 'left', field: 'name', sortable: true },
  { name: 'latitude', label: t('lat'), align: 'left', field: 'latitude' },
  { name: 'longitude', label: t('lng'), align: 'left', field: 'longitude' },
  { name: 'pointValue', label: 'Pts', align: 'center', field: 'pointValue', sortable: true },
  { name: 'bonusForFirst', label: t('bonusForFirst'), align: 'center', field: 'bonusForFirst', sortable: true },
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

  const initName = localStorage.getItem('adminMapLayer') || 'topo'
  activeBaseName.value = initName
  currentBaseTile = baseLayers.value.find(l => l.name === initName).tile
  currentBaseTile.addTo(map)

  map.on('dblclick', (e) => {
    form.value.latitude = Number(e.latlng.lat.toFixed(6))
    form.value.longitude = Number(e.latlng.lng.toFixed(6))
    showDialog.value = true
  })
  setTimeout(() => map.invalidateSize(), 100)
  await fetchCheckpoints()
  mapReady.value = true
})

let cpMarkers = []

const fetchCheckpoints = async () => {
  tableLoading.value = true
  try {
    const res = await api.get(`/admin/events/${eventId}/checkpoints`)
    checkpoints.value = res.data

    // Clear old markers
    cpMarkers.forEach(m => map.removeLayer(m))
    cpMarkers = []

    checkpoints.value.forEach(cp => {
      const marker = L.marker([cp.latitude, cp.longitude], { draggable: true })
        .bindPopup(`<b>${cp.name}</b><br><span style="font-size:11px;color:#888;">Drag to reposition</span>`)
        .addTo(map)

      marker.on('dragend', async () => {
        const { lat, lng } = marker.getLatLng()
        const newLat = Number(lat.toFixed(6))
        const newLng = Number(lng.toFixed(6))
        try {
          await api.put(`/admin/events/${eventId}/checkpoints/${cp.id}`, { latitude: newLat, longitude: newLng })
          cp.latitude = newLat
          cp.longitude = newLng
          marker.bindPopup(`<b>${cp.name}</b><br><span style="font-size:11px;color:#888;">Drag to reposition</span>`)
          $q.notify({ type: 'positive', message: t('checkpointMoved'), position: 'top-right', timeout: 1800 })
        } catch (err) {
          console.error(err)
          marker.setLatLng([cp.latitude, cp.longitude])
          $q.notify({ type: 'negative', message: t('failedToSaveSettings'), position: 'top-right', timeout: 2000 })
        }
      })

      cpMarkers.push(marker)
    })

    if (cpMarkers.length > 0) {
      map.fitBounds(new L.featureGroup(cpMarkers).getBounds().pad(0.1))
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 15)
        showLocationDot(map, pos.coords.latitude, pos.coords.longitude)
      })
    }
  } catch (err) { console.error(err) }
  finally { tableLoading.value = false }
}

const openEditDialog = async (cp) => {
  editForm.value = { id: cp.id, name: cp.name, latitude: cp.latitude, longitude: cp.longitude, pointValue: cp.pointValue, bonusForFirst: cp.bonusForFirst ?? 0 }
  editBonusEnabled.value = (cp.bonusForFirst ?? 0) > 0
  editDialog.value = true
  await nextTick()
  if (editMap) { editMap.remove(); editMap = null; editMarker = null; editCurrentBaseTile = null }
  editMap = L.map('edit-map', { zoomControl: false }).setView([cp.latitude, cp.longitude], 16)

  const eName = localStorage.getItem('adminMapLayer') || 'topo'
  editBaseName.value = eName
  editBaseLayers.value = [
    { name: 'street',    label: '🗺️ Street',      tile: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }) },
    { name: 'topo',      label: '⛰️ Topographic', tile: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' }) },
    { name: 'satellite', label: '🛰️ Satellite',   tile: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }) },
    { name: 'dark',      label: '🌙 Dark',         tile: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB' }) },
  ]
  editCurrentBaseTile = editBaseLayers.value.find(l => l.name === eName).tile
  editCurrentBaseTile.addTo(editMap)
  editMarker = L.marker([cp.latitude, cp.longitude], { draggable: true }).addTo(editMap)
  editMarker.on('dragend', () => {
    const { lat, lng } = editMarker.getLatLng()
    editForm.value.latitude = Number(lat.toFixed(6))
    editForm.value.longitude = Number(lng.toFixed(6))
  })
  editMap.on('click', (e) => {
    editMarker.setLatLng(e.latlng)
    editForm.value.latitude = Number(e.latlng.lat.toFixed(6))
    editForm.value.longitude = Number(e.latlng.lng.toFixed(6))
  })
  setTimeout(() => editMap.invalidateSize(), 150)
}

const onEditDialogHide = () => {
  if (editMap) { editMap.remove(); editMap = null; editMarker = null; editCurrentBaseTile = null }
}

const saveEdit = async () => {
  try {
    await api.put(`/admin/events/${eventId}/checkpoints/${editForm.value.id}`, {
      name: editForm.value.name,
      latitude: editForm.value.latitude,
      longitude: editForm.value.longitude,
      pointValue: editForm.value.pointValue,
      bonusForFirst: editForm.value.bonusForFirst,
    })
    editDialog.value = false
    fetchCheckpoints()
    $q.notify({ type: 'positive', message: t('checkpointUpdated'), position: 'top-right', timeout: 1800 })
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: t('failedToSaveSettings'), position: 'top-right', timeout: 2000 })
  }
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
    formBonusEnabled.value = false
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
.edit-zoom-btns {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.edit-layer-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
}
.edit-map-hint {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: rgba(0,0,0,0.55);
  color: #fff !important;
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
}
.admin-layer-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
}
.admin-locate-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1000;
}
.edit-locate-btn {
  position: absolute;
  bottom: 28px;
  right: 8px;
  z-index: 1000;
}
</style>
