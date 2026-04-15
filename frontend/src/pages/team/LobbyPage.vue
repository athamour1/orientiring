<template>
  <q-page class="lobby-page column items-center justify-center">
    <div class="lobby-card text-center">
      <!-- Pulsing icon -->
      <div class="lobby-icon q-mb-lg">
        <q-icon name="explore" size="64px" color="primary" class="pulse-icon" />
      </div>

      <!-- Event name -->
      <div class="text-h5 text-weight-bold q-mb-xs">{{ eventName || $t('welcomeMessage') }}</div>

      <!-- Event description -->
      <div v-if="eventDescription" class="text-body2 text-grey q-mb-lg" style="max-width: 320px;">
        {{ eventDescription }}
      </div>

      <!-- Countdown -->
      <div v-if="hasStartTime" class="countdown-section q-mb-lg">
        <div class="text-caption text-uppercase text-grey-6 q-mb-sm">{{ $t('eventStartsIn') }}</div>
        <div class="countdown-timer text-h3 text-weight-bold text-primary">
          {{ countdownLabel }}
        </div>
      </div>

      <!-- No scheduled time -->
      <div v-else class="q-mb-lg">
        <q-spinner-dots color="primary" size="32px" class="q-mb-sm" />
        <div class="text-body1 text-grey-7">{{ $t('waitingForOrganizer') }}</div>
      </div>

      <!-- Status chip -->
      <q-chip
        :color="hasStartTime ? 'warning' : 'grey-5'"
        text-color="white"
        icon="schedule"
        class="text-weight-medium"
      >
        {{ hasStartTime ? $t('scheduledEvent') : $t('pendingActivation') }}
      </q-chip>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useI18n } from 'vue-i18n'
import { useTeamEventStore } from 'src/stores/teamEvent'
import { useEventSocket } from 'src/composables/useEventSocket'

const router = useRouter()
const { locale } = useI18n()
const teamEventStore = useTeamEventStore()

const eventName = ref(teamEventStore.eventName)
const eventDescription = ref(teamEventStore.eventDescription)
const startTime = ref(teamEventStore.startTime)
const now = ref(Date.now())

const hasStartTime = computed(() => !!startTime.value)

function pad(n) { return String(n).padStart(2, '0') }
const countdownLabel = computed(() => {
  if (!startTime.value) return ''
  const ms = new Date(startTime.value).getTime() - now.value
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
})

let tickInterval = null
let pollInterval = null
let socket = null

async function fetchEvent() {
  try {
    const res = await api.get('/team/events/active')
    const data = res.data
    if (!data) return

    // Update store
    teamEventStore.eventStatus = data.status
    teamEventStore.eventId = data.id
    teamEventStore.eventName = data.name
    teamEventStore.eventDescription = data.description ?? null
    teamEventStore.startTime = data.startTime ?? null
    teamEventStore.endTime = data.endTime ?? null

    // Update local refs
    eventName.value = data.name
    eventDescription.value = data.description ?? null
    startTime.value = data.startTime ?? null

    if (data.language) locale.value = data.language

    if (data.status === 'active') {
      router.replace('/team/map')
    }
  } catch {
    // silently retry on next poll
  }
}

function goToMap() {
  router.replace('/team/map')
}

onMounted(async () => {
  tickInterval = setInterval(() => { now.value = Date.now() }, 1000)

  await fetchEvent()
  pollInterval = setInterval(fetchEvent, 30000)

  // WebSocket — listen for instant activation
  if (teamEventStore.eventId) {
    const ws = useEventSocket(teamEventStore.eventId)
    socket = ws.socket
    socket.on('event:activated', goToMap)
  }
})

onUnmounted(() => {
  clearInterval(tickInterval)
  clearInterval(pollInterval)
})
</script>

<style scoped>
.lobby-page {
  min-height: 100%;
  padding: 24px;
}

.lobby-card {
  max-width: 400px;
  width: 100%;
}

.lobby-icon {
  display: inline-block;
}

.pulse-icon {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}

.countdown-timer {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
</style>
