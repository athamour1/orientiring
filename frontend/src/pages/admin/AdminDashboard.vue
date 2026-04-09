<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('activeEvents') }}</div>
      <q-space />
      <q-btn color="primary" icon="add" :label="$t('newEvent')" unelevated no-caps @click="showNewEventDialog = true" />
    </div>

    <q-card flat bordered class="shadow-2">
      <q-table
        :rows="!store.loaded ? skeletonRows : events"
        :columns="columns"
        row-key="id"
        flat
        class="admin-table"
      >
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <q-skeleton v-if="!store.loaded" type="text" />
              <template v-else-if="col.name === 'actions'">
                <q-btn flat round color="primary" dense icon="settings" @click="$router.push(`/admin/events/${props.row.id}`)">
                  <q-tooltip>{{ $t('manage') }}</q-tooltip>
                </q-btn>
                <q-btn flat round color="secondary" dense icon="share" class="q-ml-xs" @click="copyLeaderboardLink(props.row.id)">
                  <q-tooltip>{{ $t('copyPublicLink') }}</q-tooltip>
                </q-btn>
                <q-btn flat round color="negative" dense icon="delete" class="q-ml-xs" @click="confirmDeleteEvent(props.row)" />
              </template>
              <template v-else>{{ col.value }}</template>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>

    <!-- New Event Wizard -->
    <q-dialog v-model="showNewEventDialog" @hide="destroyNewEventMap" persistent>
      <q-card :style="$q.screen.gt.sm ? 'width: 680px; max-width: 95vw;' : 'width: 95vw;'" style="border-radius: 20px;">
        <q-stepper v-model="wizardStep" ref="stepper" color="primary" animated flat header-nav :contracted="$q.screen.lt.sm" :alternative-labels="$q.screen.gt.xs">

          <!-- Step 1: Basics -->
          <q-step :name="1" :title="$t('basics')" icon="edit_note" :done="wizardStep > 1">
            <div class="q-gutter-md q-pt-sm">
              <q-input
                v-model="newEvent.name"
                :label="$t('eventName')"
                :placeholder="$t('eventNamePlaceholder')"
                autofocus outlined
                :rules="[val => !!val || t('eventNameRequired')]"
              />
              <q-input
                v-model="newEvent.description"
                :label="$t('eventDesc')"
                type="textarea" outlined autogrow
              />
              <div>
                <div class="text-caption text-grey-7 q-mb-xs">{{ $t('language') }}</div>
                <q-btn-toggle
                  v-model="newEvent.language"
                  unelevated rounded toggle-color="primary"
                  :options="[
                    { label: $t('english'), value: 'en-US' },
                    { label: $t('greek'),   value: 'el' },
                  ]"
                />
              </div>
            </div>
          </q-step>

          <!-- Step 2: Settings -->
          <q-step :name="2" :title="$t('settings')" icon="tune" :done="wizardStep > 2">
            <div class="q-gutter-md q-pt-sm">
              <q-toggle v-model="newEvent.isActive" :label="$t('activateImmediately')" checked-icon="check" unchecked-icon="clear" color="positive" size="lg" />
              <q-separator />
              <q-toggle v-model="newEvent.showTeamLocation" :label="$t('showTeamLocation')" checked-icon="location_on" unchecked-icon="location_off" color="primary" size="lg" />
              <q-separator />
              <q-toggle v-model="newEvent.showDirectionArrow" :label="$t('showDirectionArrow')" checked-icon="navigation" unchecked-icon="radio_button_unchecked" color="primary" size="lg" />
              <div class="text-caption text-grey-7">{{ $t('showDirectionArrowDesc') }}</div>
              <q-separator />
              <div class="text-subtitle2 text-weight-bold">🏅 {{ $t('firstFinishBonus') }}</div>
              <div class="text-caption text-grey-7">{{ $t('firstFinishBonusDesc') }}</div>
              <q-input v-model.number="newEvent.firstFinishBonus" :label="$t('bonusPoints')" outlined type="number" min="0" :hint="$t('firstFinishBonusHint')" />
            </div>
          </q-step>

          <!-- Step 3: Schedule -->
          <q-step :name="3" :title="$t('eventTimer')" icon="schedule" :done="wizardStep > 3">
            <div class="q-gutter-md q-pt-sm">
              <div class="text-caption text-grey-7">{{ $t('eventTimerDesc') }}</div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <q-input
                    :model-value="newEvent.startTime ? formatDateTime(newEvent.startTime) : ''"
                    :label="$t('startTime')"
                    outlined readonly clearable
                    @clear="newEvent.startTime = null"
                  >
                    <template v-slot:prepend>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="newEvent.startTime" mask="YYYY-MM-DDTHH:mm" today-btn>
                            <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                    <template v-slot:append>
                      <q-icon name="access_time" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-time v-model="newEvent.startTime" mask="YYYY-MM-DDTHH:mm" format24h>
                            <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                          </q-time>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    :model-value="newEvent.endTime ? formatDateTime(newEvent.endTime) : ''"
                    :label="$t('endTime')"
                    outlined readonly clearable
                    @clear="newEvent.endTime = null"
                  >
                    <template v-slot:prepend>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="newEvent.endTime" mask="YYYY-MM-DDTHH:mm" today-btn>
                            <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                    <template v-slot:append>
                      <q-icon name="access_time" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-time v-model="newEvent.endTime" mask="YYYY-MM-DDTHH:mm" format24h>
                            <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                          </q-time>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
              </div>
            </div>
          </q-step>

          <!-- Step 4: Location -->
          <q-step :name="4" :title="$t('startReturnPoints')" icon="flag">
            <div class="q-gutter-sm q-pt-sm">
              <div class="text-caption text-grey-7">{{ $t('startReturnDesc') }}</div>
              <div class="row q-gutter-sm">
                <q-btn-toggle
                  v-model="newPointMode"
                  unelevated rounded toggle-color="primary"
                  :options="[
                    { label: $t('setStartPoint'), value: 'start' },
                    { label: $t('setReturnPoint'), value: 'return' },
                  ]"
                  :disable="newEvent.returnSameAsStart"
                />
              </div>
              <q-toggle v-model="newEvent.returnSameAsStart" :label="$t('returnSameAsStart')" color="primary" @update:model-value="onNewReturnSameToggle" />
              <div style="position:relative; border-radius:10px; overflow:hidden; height:240px;">
                <div id="new-event-map" style="height:240px; width:100%;"></div>
                <div class="new-event-zoom-btns">
                  <q-btn round elevated color="white" text-color="dark" icon="add" size="xs" @click="newEventMap && newEventMap.zoomIn()" />
                  <q-btn round elevated color="white" text-color="dark" icon="remove" size="xs" @click="newEventMap && newEventMap.zoomOut()" />
                </div>
                <div class="new-event-layer-btn">
                  <q-btn round elevated icon="layers" color="white" text-color="grey-8" size="xs">
                    <q-menu anchor="top right" self="bottom right" :offset="[0, 6]">
                      <q-list dense style="min-width:150px; padding: 4px;">
                        <q-item v-for="layer in newEventBaseLayers" :key="layer.name" clickable @click="switchNewEventBase(layer)" v-close-popup :class="['layer-item', { 'layer-item--active': newEventBaseName === layer.name }]">
                          <q-item-section>{{ layer.label }}</q-item-section>
                        </q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </div>
              </div>
              <div class="row q-gutter-md text-caption">
                <div class="row items-center q-gutter-xs">
                  <div style="width:10px;height:10px;border-radius:50%;background:#43a047;"></div>
                  <span>{{ $t('startPoint') }}: {{ newEvent.startLat ? `${newEvent.startLat}, ${newEvent.startLng}` : $t('notSet') }}</span>
                </div>
                <div v-if="!newEvent.returnSameAsStart" class="row items-center q-gutter-xs">
                  <div style="width:10px;height:10px;border-radius:50%;background:#e53935;"></div>
                  <span>{{ $t('returnPoint') }}: {{ newEvent.returnLat ? `${newEvent.returnLat}, ${newEvent.returnLng}` : $t('notSet') }}</span>
                </div>
              </div>
            </div>
          </q-step>

          <template v-slot:navigation>
            <q-stepper-navigation class="row items-center q-pt-md">
              <q-btn flat :label="$t('cancel')" color="grey-7" no-caps @click="showNewEventDialog = false" />
              <q-space />
              <q-btn v-if="wizardStep > 1" flat :label="$t('back')" color="grey-7" no-caps class="q-mr-sm" @click="stepper.previous()" />
              <q-btn
                v-if="wizardStep < 4"
                unelevated color="primary" :label="$t('next')" no-caps
                @click="goNext"
              />
              <q-btn
                v-else
                unelevated color="positive" icon="rocket_launch" :label="$t('deployEvent')" no-caps
                @click="createEvent"
              />
            </q-stepper-navigation>
          </template>

        </q-stepper>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useEventsStore } from 'src/stores/events'
import { api } from 'boot/axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const $q = useQuasar()
const { t } = useI18n()
const store = useEventsStore()
const events = computed(() => store.events)
const skeletonRows = Array.from({ length: 4 }, (_, i) => ({ id: i }))
const showNewEventDialog = ref(false)
const wizardStep = ref(1)
const stepper = ref(null)

const defaultEvent = () => ({ name: '', description: '', isActive: false, showTeamLocation: true, showDirectionArrow: false, startTime: null, endTime: null, firstFinishBonus: 0, language: 'en-US', startLat: null, startLng: null, returnLat: null, returnLng: null, returnSameAsStart: true })
const newEvent = ref(defaultEvent())

const newPointMode = ref('start')
let newEventMap = null
let newEventStartMarker = null
let newEventReturnMarker = null
let newEventCurrentBase = null
const newEventBaseLayers = ref([])
const newEventBaseName = ref('topo')

const newEventStartIcon = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#43a047;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
const newEventReturnIcon = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#e53935;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })

// Init map when navigating to step 4
watch(wizardStep, async (val) => {
  if (val === 4) {
    await nextTick()
    if (newEventMap) { newEventMap.invalidateSize(); return }
    newEventMap = L.map('new-event-map', { zoomControl: false }).setView([38.0, 23.7], 11)
    newEventBaseLayers.value = [
      { name: 'street',    label: '🗺️ Street',      tile: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }) },
      { name: 'topo',      label: '⛰️ Topographic', tile: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' }) },
      { name: 'satellite', label: '🛰️ Satellite',   tile: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }) },
      { name: 'dark',      label: '🌙 Dark',         tile: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB' }) },
    ]
    const initName = localStorage.getItem('adminMapLayer') || 'topo'
    newEventBaseName.value = initName
    newEventCurrentBase = newEventBaseLayers.value.find(l => l.name === initName).tile
    newEventCurrentBase.addTo(newEventMap)
    newEventMap.on('click', (e) => placeNewEventMarker(e.latlng, newEvent.value.returnSameAsStart ? 'start' : newPointMode.value))
    setTimeout(() => newEventMap.invalidateSize(), 150)
  }
})

function switchNewEventBase(layer) {
  if (!newEventMap || !layer) return
  if (newEventCurrentBase) newEventMap.removeLayer(newEventCurrentBase)
  layer.tile.addTo(newEventMap)
  newEventCurrentBase = layer.tile
  newEventBaseName.value = layer.name
  localStorage.setItem('adminMapLayer', layer.name)
}

function placeNewEventMarker(latlng, type) {
  if (type === 'start') {
    if (newEventStartMarker) newEventMap.removeLayer(newEventStartMarker)
    newEventStartMarker = L.marker(latlng, { icon: newEventStartIcon }).addTo(newEventMap)
    newEvent.value.startLat = Number(latlng.lat.toFixed(6))
    newEvent.value.startLng = Number(latlng.lng.toFixed(6))
    if (newEvent.value.returnSameAsStart) {
      newEvent.value.returnLat = newEvent.value.startLat
      newEvent.value.returnLng = newEvent.value.startLng
    }
  } else {
    if (newEventReturnMarker) newEventMap.removeLayer(newEventReturnMarker)
    newEventReturnMarker = L.marker(latlng, { icon: newEventReturnIcon }).addTo(newEventMap)
    newEvent.value.returnLat = Number(latlng.lat.toFixed(6))
    newEvent.value.returnLng = Number(latlng.lng.toFixed(6))
  }
}

function onNewReturnSameToggle(val) {
  if (val) {
    if (newEventReturnMarker) { newEventMap.removeLayer(newEventReturnMarker); newEventReturnMarker = null }
    newEvent.value.returnLat = newEvent.value.startLat
    newEvent.value.returnLng = newEvent.value.startLng
    newPointMode.value = 'start'
  }
}

function destroyNewEventMap() {
  if (newEventMap) { newEventMap.remove(); newEventMap = null; newEventStartMarker = null; newEventReturnMarker = null; newEventCurrentBase = null }
  newEvent.value = defaultEvent()
  newPointMode.value = 'start'
  wizardStep.value = 1
}

function goNext() {
  if (wizardStep.value === 1 && !newEvent.value.name.trim()) {
    $q.notify({ type: 'warning', message: t('eventNameRequired'), position: 'top', timeout: 1500 })
    return
  }
  stepper.value.next()
}

function formatDateTime(val) {
  if (!val) return ''
  return new Date(val).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => { if (!store.loaded) store.fetchEvents() })

const copyLeaderboardLink = (eventId) => {
  const url = `${window.location.protocol}//${window.location.host}/leaderboard/${eventId}`
  navigator.clipboard.writeText(url)
}

const columns = computed(() => [
  { name: 'id', required: true, label: t('id'), align: 'left', field: 'id', sortable: true },
  { name: 'name', required: true, label: t('name'), align: 'left', field: 'name', sortable: true },
  { name: 'isActive', label: t('status'), align: 'center', field: 'isActive', sortable: true, format: val => val ? t('live') : t('draft') },
  { name: 'actions', label: t('actions'), align: 'right' }
])

const createEvent = async () => {
  try {
    const res = await api.post('/admin/events', {
      ...newEvent.value,
      startTime: newEvent.value.startTime ? new Date(newEvent.value.startTime).toISOString() : null,
      endTime: newEvent.value.endTime ? new Date(newEvent.value.endTime).toISOString() : null,
    })
    store.addEvent(res.data)
    showNewEventDialog.value = false
    $q.notify({ type: 'positive', message: t('eventOrchestrated'), position: 'top-right', timeout: 2500 })
  } catch (err) { console.error(err) }
}

const confirmDeleteEvent = (eventRow) => {
  $q.dialog({
    title: t('confirmDeletion'),
    message: t('confirmWipeEventNamed', { name: eventRow.name }),
    color: 'negative',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await api.delete(`/admin/events/${eventRow.id}`)
      store.removeEvent(eventRow.id)
      $q.notify({ type: 'positive', message: t('eventWiped'), position: 'top-right', timeout: 2500 })
    } catch (err) { console.error(err) }
  })
}
</script>

<style scoped>
.admin-page { max-width: 900px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
.new-event-zoom-btns {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.new-event-layer-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
}
</style>
