<template>
  <q-page class="flex flex-center lb-page">
    <div class="full-width max-w-sm q-pa-md">
      <div class="main-card q-pa-md shadow-up-10 rounded-borders">
        <div class="text-center q-mb-md">
          <q-icon name="emoji_events" size="3rem" color="warning" />
          <h4 class="text-h5 text-weight-bold text-white q-mt-sm q-mb-none tracking-tight">{{ $t('liveLeaderboard') }}</h4>
          <p class="text-subtitle2 text-white opacity-80">{{ $t('updatedRealtime') }}</p>
        </div>

        <q-list separator class="q-mt-lg">
          <q-item v-for="(team, index) in leaderboard" :key="team.teamName" class="q-py-md">
             <q-item-section avatar>
                <q-avatar :color="getBadgeColor(index)" text-color="white" font-size="20px" class="text-weight-bold">
                  {{ index + 1 }}
                </q-avatar>
             </q-item-section>
             <q-item-section>
               <q-item-label class="text-weight-bold text-white text-subtitle1">{{ team.teamName }}</q-item-label>
             </q-item-section>
             <q-item-section side>
               <q-chip color="primary" text-color="white" class="text-weight-bold text-subtitle1" icon="star">
                 {{ team.score }}
               </q-chip>
             </q-item-section>
          </q-item>
        </q-list>
        <div v-if="leaderboard.length === 0" class="text-center text-white opacity-80 q-my-xl">
          {{ $t('noTeamsScored') }}
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'
import { useEventSocket } from 'src/composables/useEventSocket'

const leaderboard = ref([])
const route = useRoute()
let currentEventId = null

const fetchLeaderboard = async () => {
  try {
    let eventId = currentEventId || route.params.eventId

    if (!eventId) {
      const activeEv = await api.get('/team/events/active')
      if (activeEv.data?.id) {
        eventId = activeEv.data.id
        currentEventId = eventId
      } else {
        return
      }
    }

    const res = await api.get(`/public/events/${eventId}/leaderboard`)
    leaderboard.value = Array.isArray(res.data) ? res.data : res.data.leaderboard
  } catch {
    // Non-critical failure — UI shows stale data
  }
}

onMounted(async () => {
  await fetchLeaderboard()
  if (currentEventId) {
    const { socket } = useEventSocket(currentEventId)
    socket.on('scan:created', fetchLeaderboard)
  }
})

const getBadgeColor = (index) => {
  if (index === 0) return 'amber-8'
  if (index === 1) return 'grey-5'
  if (index === 2) return 'brown-5'
  return 'primary'
}
</script>

<style scoped>
.lb-page {
  background: linear-gradient(160deg, #150b24 0%, #2a1060 45%, #8e5add 100%);
  min-height: 100%;
}
.main-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  color: #fff;
}
.opacity-80 { opacity: 0.8; }
.max-w-sm { max-width: 500px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
</style>
