<template>
  <q-page class="q-pa-lg max-w-md mx-auto">
    <div class="row items-center q-mb-xl">
      <q-btn flat round icon="arrow_back" color="grey-8" @click="$router.back()" class="q-mr-sm" />
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

        <!-- Timer section -->
        <div class="text-subtitle2 text-weight-bold q-mb-xs">⏱ {{ $t('eventTimer') }}</div>
        <div class="text-caption text-grey-7 q-mb-sm">{{ $t('eventTimerDesc') }}</div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.startTime"
              :label="$t('startTime')"
              outlined
              type="datetime-local"
              clearable
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.endTime"
              :label="$t('endTime')"
              outlined
              type="datetime-local"
              clearable
            />
          </div>
        </div>

        <div class="row q-mt-md">
          <q-btn unelevated color="primary" :label="$t('saveChanges')" type="submit" class="full-width" size="lg" no-caps />
        </div>
      </q-form>
    </q-card>

    <q-card flat bordered class="q-pa-md q-mb-lg" style="border-color: var(--q-primary);">
      <div class="row items-center q-mb-sm">
        <q-icon name="share" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold text-primary">{{ $t('publicLeaderboard') }}</div>
      </div>
      <div class="text-body2 q-mb-md">{{ $t('shareLinkDesc') }}</div>
      <div class="row items-center q-gutter-sm">
        <q-input :value="publicUrl" outlined dense readonly class="col" />
        <q-btn unelevated color="primary" icon="content_copy" :label="$t('copy')" @click="copyLink" no-caps />
      </div>
      <div v-if="copied" class="text-positive text-caption q-mt-sm">{{ $t('linkCopiedToClipboard') }}</div>
    </q-card>

    <q-card flat bordered class="q-pa-md border-red">
      <div class="text-h6 text-negative text-weight-bold tracking-tight q-mb-sm">{{ $t('dangerZone') }}</div>
      <div class="text-body2 q-mb-md">{{ $t('deleteDesc') }}</div>
      <q-btn outline color="negative" icon="delete_forever" :label="$t('deleteHunt')" @click="confirmDelete" no-caps />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from 'boot/axios'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const eventId = route.params.eventId

const form = ref({ name: '', description: '', isActive: false, showTeamLocation: true, startTime: null, endTime: null })
const copied = ref(false)
const publicUrl = `${window.location.protocol}//${window.location.host}/#/leaderboard/${eventId}`

// Convert ISO string → datetime-local string (YYYY-MM-DDTHH:mm)
function toLocalInput(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const copyLink = () => {
  navigator.clipboard.writeText(publicUrl)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

onMounted(async () => {
  try {
    const res = await api.get(`/admin/events/${eventId}`)
    form.value = {
      name: res.data.name,
      description: res.data.description,
      isActive: res.data.isActive,
      showTeamLocation: res.data.showTeamLocation ?? true,
      startTime: toLocalInput(res.data.startTime),
      endTime: toLocalInput(res.data.endTime),
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
  } catch (err) { console.error(err) }
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
      router.push('/admin')
      setTimeout(() => window.location.reload(), 500)
    } catch (err) { console.error(err) }
  })
}
</script>

<style scoped>
.tracking-tight { letter-spacing: -0.02em; }
.max-w-md { max-width: 600px; }
.border-red { border-color: rgba(193,0,21,0.2); }
</style>
