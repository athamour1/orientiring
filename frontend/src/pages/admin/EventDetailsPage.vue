<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <q-btn flat round icon="arrow_back" color="grey-8" @click="$router.back()" class="q-mr-sm" />
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('checkpoints') }}</div>
      <q-space />
      <q-btn color="primary" icon="place" :label="$t('addCheckpoint')" unelevated no-caps @click="showDialog = true" />
    </div>

    <!-- Map Preview -->
    <q-card flat bordered class="shadow-2 q-mb-lg overflow-hidden" style="border-radius:14px;">
      <div id="admin-map" style="height: 320px; width: 100%;"></div>
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
const showDialog = ref(false)
const previewDialog = ref(false)
const previewCp = ref(null)
const previewUrl = ref('')
const form = ref({ name: '', latitude: null, longitude: null, pointValue: 10, bonusForFirst: 0 })
let map = null

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
  map = L.map('admin-map', { doubleClickZoom: false }).setView([0, 0], 2)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
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
</style>
