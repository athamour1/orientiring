<template>
  <q-page class="q-pa-lg admin-page max-w-md mx-auto">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('eventSettings') }}</div>
    </div>

    <q-card flat bordered class="q-pa-md shadow-2 q-mb-lg">
      <q-form @submit="updateEvent" class="q-gutter-md">
        <q-input v-model="form.name" :label="$t('eventName')" outlined :rules="[val => !!val || t('eventNameRequired')]" />

        <q-input v-model="form.description" :label="$t('eventDesc')" outlined type="textarea" autogrow />

        <q-toggle
          v-model="form.isActive"
          checked-icon="check"
          unchecked-icon="clear"
          :label="$t('eventIsLive')"
          color="positive"
          size="lg"
          class="q-mt-sm"
        />

        <q-toggle
          v-model="form.showTeamLocation"
          checked-icon="location_on"
          unchecked-icon="location_off"
          :label="$t('showTeamLocation')"
          color="primary"
          size="lg"
        />

        <q-separator class="q-my-sm" />

        <!-- First finisher bonus -->
        <div class="text-subtitle2 text-weight-bold q-mb-xs">🏅 {{ $t('firstFinishBonus') }}</div>
        <div class="text-caption text-grey-7 q-mb-sm">{{ $t('firstFinishBonusDesc') }}</div>
        <q-input
          v-model.number="form.firstFinishBonus"
          :label="$t('bonusPoints')"
          outlined
          type="number"
          min="0"
          :hint="$t('firstFinishBonusHint')"
        />

        <q-separator class="q-my-sm" />

        <!-- Timer section -->
        <div class="text-subtitle2 text-weight-bold q-mb-xs">⏱ {{ $t('eventTimer') }}</div>
        <div class="text-caption text-grey-7 q-mb-sm">{{ $t('eventTimerDesc') }}</div>

        <div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="form.startTime ? formatDateTime(form.startTime) : ''"
                :label="$t('startTime')"
                outlined readonly clearable
                @clear="form.startTime = null"
              >
                <template v-slot:prepend>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.startTime" mask="YYYY-MM-DDTHH:mm" today-btn>
                        <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="form.startTime" mask="YYYY-MM-DDTHH:mm" format24h>
                        <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="form.endTime ? formatDateTime(form.endTime) : ''"
                :label="$t('endTime')"
                outlined readonly clearable
                @clear="form.endTime = null"
              >
                <template v-slot:prepend>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.endTime" mask="YYYY-MM-DDTHH:mm" today-btn>
                        <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="form.endTime" mask="YYYY-MM-DDTHH:mm" format24h>
                        <div class="row items-center justify-end"><q-btn v-close-popup label="OK" color="primary" flat no-caps /></div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>

      </q-form>
    </q-card>

    <!-- Language preference (admin only) -->
    <q-card flat bordered class="q-pa-md shadow-2 q-mb-lg">
      <div class="row items-center q-mb-md">
        <q-icon name="translate" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold">{{ $t('language') }}</div>
      </div>
      <q-btn-toggle
        v-model="form.language"
        unelevated
        rounded
        toggle-color="primary"
        :options="[
          { label: $t('english'), value: 'en-US' },
          { label: $t('greek'),   value: 'el' },
        ]"
      />
    </q-card>

    <q-card flat bordered class="q-pa-md q-mb-lg" style="border-color: var(--q-primary);">
      <div class="row items-center q-mb-sm">
        <q-icon name="share" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold text-primary">{{ $t('publicLeaderboard') }}</div>
      </div>
      <div class="text-body2 q-mb-md">{{ $t('shareLinkDesc') }}</div>
      <div class="row items-center q-gutter-sm">
        <q-input :model-value="publicUrl" outlined dense readonly class="col" />
        <q-btn unelevated color="primary" icon="content_copy" :label="$t('copy')" @click="copyLink" no-caps />
      </div>
      <div v-if="copied" class="text-positive text-caption q-mt-sm">{{ $t('linkCopiedToClipboard') }}</div>
    </q-card>

    <!-- Start / Return points -->
    <q-card flat bordered class="q-pa-md shadow-2 q-mb-lg">
      <div class="row items-center q-mb-sm">
        <q-icon name="flag" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold">{{ $t('startReturnPoints') }}</div>
      </div>
      <div class="text-caption text-grey-7 q-mb-md">{{ $t('startReturnDesc') }}</div>

      <div class="row q-gutter-sm q-mb-sm">
        <q-btn-toggle
          v-model="pointMode"
          unelevated rounded
          toggle-color="primary"
          :options="[
            { label: $t('setStartPoint'), value: 'start' },
            { label: $t('setReturnPoint'), value: 'return' },
          ]"
          :disable="pointMode === 'return' && form.returnSameAsStart"
        />
      </div>

      <q-toggle
        v-model="form.returnSameAsStart"
        :label="$t('returnSameAsStart')"
        color="primary"
        class="q-mb-sm"
        @update:model-value="onReturnSameToggle"
      />

      <div class="text-caption text-grey-7 q-mb-xs">{{ $t('clickMapToSet') }}</div>

      <div style="position: relative; border-radius: 12px; overflow: hidden;">
        <div id="points-map" style="height: 280px; width: 100%;"></div>
        <div class="points-zoom-btns">
          <q-btn round elevated color="white" text-color="dark" icon="add" size="sm" @click="pointsMap && pointsMap.zoomIn()" />
          <q-btn round elevated color="white" text-color="dark" icon="remove" size="sm" @click="pointsMap && pointsMap.zoomOut()" />
        </div>
      </div>

      <div class="row q-mt-sm q-gutter-md text-caption">
        <div class="row items-center q-gutter-xs">
          <div style="width:12px;height:12px;border-radius:50%;background:#43a047;"></div>
          <span>{{ $t('startPoint') }}: {{ form.startLat ? `${form.startLat}, ${form.startLng}` : $t('notSet') }}</span>
        </div>
        <div v-if="!form.returnSameAsStart" class="row items-center q-gutter-xs">
          <div style="width:12px;height:12px;border-radius:50%;background:#e53935;"></div>
          <span>{{ $t('returnPoint') }}: {{ form.returnLat ? `${form.returnLat}, ${form.returnLng}` : $t('notSet') }}</span>
        </div>
        <div v-else class="row items-center q-gutter-xs text-grey-6">
          <q-icon name="sync" size="12px" />
          <span>{{ $t('returnSameAsStartShort') }}</span>
        </div>
      </div>
    </q-card>

    <q-btn unelevated color="primary" :label="$t('saveChanges')" @click="updateEvent" class="full-width q-mb-lg" size="lg" no-caps />

    <q-card flat bordered class="q-pa-md border-red">
      <div class="text-h6 text-negative text-weight-bold tracking-tight q-mb-sm">{{ $t('dangerZone') }}</div>
      <div class="text-body2 q-mb-md">{{ $t('deleteDesc') }}</div>
      <q-btn outline color="negative" icon="delete_forever" :label="$t('deleteHunt')" @click="confirmDelete" no-caps />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { api } from 'boot/axios'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useEventsStore } from 'src/stores/events'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
const eventsStore = useEventsStore()

const $q = useQuasar()
const { t } = useI18n()

const applyLang = (lang) => {
  form.value.language = lang
}
const route = useRoute()
const router = useRouter()
const eventId = route.params.eventId

const form = ref({ name: '', description: '', isActive: false, showTeamLocation: true, startTime: null, endTime: null, language: 'en-US', firstFinishBonus: 0, startLat: null, startLng: null, returnLat: null, returnLng: null, returnSameAsStart: true })
const pointMode = ref('start')
let pointsMap = null
let startMarker = null
let returnMarker = null

const startIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#43a047;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
const returnIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#e53935;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })

function placeMarker(latlng, type) {
  if (type === 'start') {
    if (startMarker) pointsMap.removeLayer(startMarker)
    startMarker = L.marker(latlng, { icon: startIcon }).addTo(pointsMap)
    form.value.startLat = Number(latlng.lat.toFixed(6))
    form.value.startLng = Number(latlng.lng.toFixed(6))
    if (form.value.returnSameAsStart) {
      form.value.returnLat = form.value.startLat
      form.value.returnLng = form.value.startLng
    }
  } else {
    if (returnMarker) pointsMap.removeLayer(returnMarker)
    returnMarker = L.marker(latlng, { icon: returnIcon }).addTo(pointsMap)
    form.value.returnLat = Number(latlng.lat.toFixed(6))
    form.value.returnLng = Number(latlng.lng.toFixed(6))
  }
}

function onReturnSameToggle(val) {
  if (val) {
    if (returnMarker) { pointsMap.removeLayer(returnMarker); returnMarker = null }
    form.value.returnLat = form.value.startLat
    form.value.returnLng = form.value.startLng
    pointMode.value = 'start'
  }
}

function initPointsMap() {
  pointsMap = L.map('points-map', { zoomControl: false }).setView([38.0, 23.7], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(pointsMap)
  pointsMap.on('click', (e) => placeMarker(e.latlng, form.value.returnSameAsStart ? 'start' : pointMode.value))
  setTimeout(() => pointsMap.invalidateSize(), 150)
}
const copied = ref(false)
const publicUrl = `${window.location.protocol}//${window.location.host}/leaderboard/${eventId}`

// Convert ISO string → datetime-local string (YYYY-MM-DDTHH:mm)
function toLocalInput(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateTime(val) {
  if (!val) return ''
  return new Date(val).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const copyLink = () => {
  navigator.clipboard.writeText(publicUrl)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

onMounted(async () => {
  try {
    const res = await api.get(`/admin/events/${eventId}`)
    const lang = res.data.language || 'en-US'
    form.value = {
      name: res.data.name,
      description: res.data.description,
      isActive: res.data.isActive,
      showTeamLocation: res.data.showTeamLocation ?? true,
      startTime: toLocalInput(res.data.startTime),
      endTime: toLocalInput(res.data.endTime),
      language: lang,
      firstFinishBonus: res.data.firstFinishBonus ?? 0,
      startLat: res.data.startLat ?? null,
      startLng: res.data.startLng ?? null,
      returnLat: res.data.returnLat ?? null,
      returnLng: res.data.returnLng ?? null,
      returnSameAsStart: res.data.returnSameAsStart ?? true,
    }
    appLang.value = lang
    applyLang(lang)

    await nextTick()
    initPointsMap()

    // Restore existing markers
    if (form.value.startLat) {
      startMarker = L.marker([form.value.startLat, form.value.startLng], { icon: startIcon }).addTo(pointsMap)
      pointsMap.setView([form.value.startLat, form.value.startLng], 14)
    }
    if (!form.value.returnSameAsStart && form.value.returnLat) {
      returnMarker = L.marker([form.value.returnLat, form.value.returnLng], { icon: returnIcon }).addTo(pointsMap)
    }
  } catch (err) { console.error(err) }
})

const updateEvent = async () => {
  try {
    await api.put(`/admin/events/${eventId}`, {
      ...form.value,
      startTime: form.value.startTime ? new Date(form.value.startTime).toISOString() : null,
      endTime: form.value.endTime ? new Date(form.value.endTime).toISOString() : null,
    })
    $q.notify({ type: 'positive', message: t('settingsSaved'), position: 'top-right', timeout: 2500 })
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: t('failedToSaveSettings'), position: 'top-right', timeout: 2500 })
  }
}

const confirmDelete = () => {
  $q.dialog({
    title: t('confirmDeletion'),
    message: t('confirmWipeEvent'),
    color: 'negative',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await api.delete(`/admin/events/${eventId}`)
      eventsStore.removeEvent(Number(eventId))
      router.push('/admin')
      setTimeout(() => window.location.reload(), 500)
    } catch (err) { console.error(err) }
  })
}
</script>

<style scoped>
.admin-page { max-width: 900px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
.max-w-md { max-width: 600px; }
.border-red { border-color: rgba(var(--q-negative), 0.2); }
.points-zoom-btns {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
