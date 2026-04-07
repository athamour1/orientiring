<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('activeEvents') }}</div>
      <q-space />
      <q-btn color="primary" icon="add" :label="$t('newEvent')" unelevated no-caps @click="showNewEventDialog = true" />
    </div>

    <q-table
      :rows="events"
      :columns="columns"
      row-key="id"
      flat bordered
      class="shadow-2"
    >
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round color="primary" dense icon="settings" @click="$router.push(`/admin/events/${props.row.id}`)">
            <q-tooltip>{{ $t('manage') }}</q-tooltip>
          </q-btn>
          <q-btn flat round color="teal" dense icon="share" class="q-ml-xs" @click="copyLeaderboardLink(props.row.id)">
            <q-tooltip>{{ $t('copyPublicLink') }}</q-tooltip>
          </q-btn>
          <q-btn flat round color="negative" dense icon="delete" class="q-ml-xs" @click="confirmDeleteEvent(props.row)" />
        </q-td>
      </template>
    </q-table>

    <!-- New Event Modal -->
    <q-dialog v-model="showNewEventDialog">
      <q-card style="min-width: 350px" class="rounded-borders q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('createEventTitle') }}</div>
          <div class="text-subtitle2 text-grey-7">{{ $t('defineParameters') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-form @submit="createEvent" class="q-gutter-md">
            <q-input 
              v-model="newEvent.name" 
              :label="$t('eventName')" 
              :placeholder="$t('eventNamePlaceholder')"
              autofocus 
              outlined
              :rules="[val => !!val || t('eventNameRequired')]"
            />
            
            <q-input 
              v-model="newEvent.description" 
              :label="$t('eventDesc')" 
              type="textarea" 
              outlined
              autogrow 
            />
            
            <q-toggle 
              v-model="newEvent.isActive" 
              :label="$t('activateImmediately')" 
              color="positive" 
            />

            <div class="row justify-end q-mt-lg">
              <q-btn flat :label="$t('cancel')" color="grey-8" v-close-popup class="q-mr-sm" no-caps />
              <q-btn unelevated :label="$t('deployEvent')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const $q = useQuasar()
const { t } = useI18n()
const events = ref([])
const showNewEventDialog = ref(false)
const newEvent = ref({
  name: '',
  description: '',
  isActive: false
})

const copyLeaderboardLink = (eventId) => {
  const url = `${window.location.protocol}//${window.location.host}/#/leaderboard/${eventId}`
  navigator.clipboard.writeText(url)
}

const columns = computed(() => [
  { name: 'id', required: true, label: t('id'), align: 'left', field: 'id', sortable: true },
  { name: 'name', required: true, label: t('name'), align: 'left', field: 'name', sortable: true },
  { name: 'isActive', label: t('status'), align: 'center', field: 'isActive', sortable: true, format: val => val ? t('live') : t('draft') },
  { name: 'actions', label: t('actions'), align: 'right' }
])

onMounted(() => {
  fetchEvents()
})

const fetchEvents = async () => {
  try {
    const res = await api.get('/admin/events')
    events.value = res.data
  } catch { /* silent */ }
}

const createEvent = async () => {
  try {
    const res = await api.post('/admin/events', newEvent.value)
    events.value.push(res.data)
    showNewEventDialog.value = false
    newEvent.value = { name: '', description: '', isActive: false }
  } catch { /* silent */ }
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
      fetchEvents()
    } catch { /* silent */ }
  })
}
</script>
<style scoped>
.tracking-tight { letter-spacing: -0.02em; }
</style>
