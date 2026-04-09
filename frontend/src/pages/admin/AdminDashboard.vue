<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('activeEvents') }}</div>
      <q-space />
      <q-btn color="primary" icon="add" :label="$t('newEvent')" unelevated no-caps @click="showNewEventDialog = true" />
    </div>

    <q-card flat bordered class="shadow-2">
      <q-table
        :rows="events"
        :columns="columns"
        row-key="id"
        flat
        class="admin-table"
        :loading="!store.loaded"
      >
        <template v-slot:loading>
          <q-inner-loading showing>
            <div class="q-pa-md full-width">
              <q-skeleton v-for="n in 4" :key="n" type="QBtn" height="48px" class="q-mb-sm" square />
            </div>
          </q-inner-loading>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round color="primary" dense icon="settings" @click="$router.push(`/admin/events/${props.row.id}`)">
              <q-tooltip>{{ $t('manage') }}</q-tooltip>
            </q-btn>
            <q-btn flat round color="secondary" dense icon="share" class="q-ml-xs" @click="copyLeaderboardLink(props.row.id)">
              <q-tooltip>{{ $t('copyPublicLink') }}</q-tooltip>
            </q-btn>
            <q-btn flat round color="negative" dense icon="delete" class="q-ml-xs" @click="confirmDeleteEvent(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- New Event Modal -->
    <q-dialog v-model="showNewEventDialog">
      <q-card style="min-width: 420px; width: 95vw; max-width: 560px; border-radius: 20px; max-height: 90vh; display: flex; flex-direction: column;" class="q-pa-sm">
        <q-card-section class="q-pb-sm" style="flex-shrink: 0;">
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('createEventTitle') }}</div>
          <div class="text-caption text-grey-7">{{ $t('defineParameters') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none q-pb-lg" style="overflow-y: auto; flex: 1;">
            <q-form @submit="createEvent" class="q-gutter-md">

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

            <q-separator />

            <q-toggle v-model="newEvent.isActive" :label="$t('activateImmediately')" checked-icon="check" unchecked-icon="clear" color="positive" size="lg" />
            <q-toggle v-model="newEvent.showTeamLocation" :label="$t('showTeamLocation')" checked-icon="location_on" unchecked-icon="location_off" color="primary" size="lg" />

            <q-separator />

            <div class="text-subtitle2 text-weight-bold q-mb-xs">⏱ {{ $t('eventTimer') }}</div>
            <div>
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

            <q-separator />

            <div class="text-subtitle2 text-weight-bold q-mb-xs">🏅 {{ $t('firstFinishBonus') }}</div>
            <q-input v-model.number="newEvent.firstFinishBonus" :label="$t('bonusPoints')" outlined type="number" min="0" :hint="$t('firstFinishBonusHint')" />

            <q-separator />

            <div class="text-subtitle2 text-weight-bold q-mb-xs">{{ $t('language') }}</div>
            <q-btn-toggle
              v-model="newEvent.language"
              unelevated rounded toggle-color="primary"
              :options="[
                { label: $t('english'), value: 'en-US' },
                { label: $t('greek'),   value: 'el' },
              ]"
            />

            <div class="row justify-end q-mt-lg q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('deployEvent')" color="primary" type="submit" no-caps />
            </div>
            </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useEventsStore } from 'src/stores/events'
import { api } from 'boot/axios'

const $q = useQuasar()
const { t } = useI18n()
const store = useEventsStore()
const events = computed(() => store.events)
const showNewEventDialog = ref(false)
const defaultEvent = () => ({ name: '', description: '', isActive: false, showTeamLocation: true, startTime: null, endTime: null, firstFinishBonus: 0, language: 'en-US' })

function formatDateTime(val) {
  if (!val) return ''
  return new Date(val).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const newEvent = ref(defaultEvent())

onMounted(() => { if (!store.loaded) store.fetchEvents() })

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

const createEvent = async () => {
  try {
    const res = await api.post('/admin/events', {
      ...newEvent.value,
      startTime: newEvent.value.startTime ? new Date(newEvent.value.startTime).toISOString() : null,
      endTime: newEvent.value.endTime ? new Date(newEvent.value.endTime).toISOString() : null,
    })
    store.addEvent(res.data)
    showNewEventDialog.value = false
    newEvent.value = defaultEvent()
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
</style>
