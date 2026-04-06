<template>
  <q-page class="flex flex-center">
    <div class="full-width max-w-sm q-pa-md">
      <div class="main-card q-pa-md shadow-up-10 rounded-borders">
        <div class="text-center q-mb-md">
          <q-icon name="emoji_events" size="3rem" color="warning" />
          <h4 class="text-h5 text-weight-bold text-dark q-mt-sm q-mb-none tracking-tight">{{ $t('liveLeaderboard') }}</h4>
          <p class="text-subtitle2 text-grey-8 opacity-80">{{ $t('updatedRealtime') }}</p>
        </div>

        <q-list separator class="q-mt-lg">
          <q-item v-for="(team, index) in leaderboard" :key="team.teamName" class="q-py-md">
             <q-item-section avatar>
                <q-avatar :color="getBadgeColor(index)" text-color="white" font-size="20px" class="text-weight-bold">
                  {{ index + 1 }}
                </q-avatar>
             </q-item-section>
             <q-item-section>
               <q-item-label class="text-weight-bold text-dark text-subtitle1">{{ team.teamName }}</q-item-label>
             </q-item-section>
             <q-item-section side>
               <q-chip color="blue-1" text-color="primary" class="text-weight-bold text-subtitle1" icon="star">
                 {{ team.score }}
               </q-chip>
             </q-item-section>
          </q-item>
        </q-list>
        <div v-if="leaderboard.length === 0" class="text-center text-grey-8 opacity-80 q-my-xl">
          {{ $t('noTeamsScored') }}
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'

const leaderboard = ref([])
const route = useRoute()
let poller = null
let currentEventId = null

const fetchLeaderboard = async () => {
  try {
    let eventId = currentEventId || route.params.eventId
    
    // If accessed through nested team routing without explicit parameter
    if (!eventId) {
      const activeEv = await api.get('/team/events/active')
      if (activeEv.data?.id) {
        eventId = activeEv.data.id
        currentEventId = eventId
      } else {
        return // Fast fail render gracefully instead of 404ing
      }
    }
    
    const res = await api.get(`/public/events/${eventId}/leaderboard`)
    // Backend now returns { eventName, eventDescription, leaderboard }
    leaderboard.value = Array.isArray(res.data) ? res.data : res.data.leaderboard
  } catch {
    // Non-critical polling failure — UI shows stale data
  }
}

onMounted(() => {
  fetchLeaderboard()
  poller = setInterval(fetchLeaderboard, 5000)
})

onUnmounted(() => {
  if (poller) clearInterval(poller)
})

const getBadgeColor = (index) => {
  if (index === 0) return 'amber-8'
  if (index === 1) return 'grey-5'
  if (index === 2) return 'brown-5'
  return 'primary'
}
</script>

<style scoped>
.main-card {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
}
.opacity-80 { opacity: 0.8; }
.max-w-sm { max-width: 500px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
</style>
