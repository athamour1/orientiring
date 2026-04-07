<template>
  <div class="public-lb-page relative-position">
      <!-- Header -->
    <div class="lb-header">
      <div class="lb-icon">🏆</div>
      <h1 class="lb-title">{{ eventName }}</h1>
      <p class="lb-subtitle" v-if="eventDescription">{{ eventDescription }}</p>
      <p class="lb-subtitle">{{ $t('liveRankings') }}</p>
      <div class="live-dot"><span class="dot"></span> {{ $t('live') }}</div>
    </div>

    <!-- Board -->
    <div class="lb-body">
      <div v-if="leaderboard.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div>{{ $t('noTeamsScored') }}</div>
      </div>

      <div
        v-for="(team, index) in leaderboard"
        :key="team.teamName"
        class="lb-row"
        :class="{ gold: index===0, silver: index===1, bronze: index===2 }"
      >
        <div class="rank">
          <span v-if="index === 0">🥇</span>
          <span v-else-if="index === 1">🥈</span>
          <span v-else-if="index === 2">🥉</span>
          <span v-else class="rank-num">{{ index + 1 }}</span>
        </div>
        <div class="team-name">{{ team.teamName }}</div>
        <div class="score">
          <span class="star">⭐</span>
          {{ team.score }} {{ $t('pts') }}
        </div>
      </div>
    </div>

    <!-- Share / copy -->
    <div class="lb-footer">
      <q-btn class="copy-btn" no-caps unelevated rounded @click="copyLink">
        <span class="q-mr-sm">🔗</span> {{ $t('copyShareableLink') }}
      </q-btn>
      <div class="copied-note" v-if="copied">{{ $t('linkCopied') }}</div>
      <div class="refresh-note">{{ $t('updatedRealtime') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { useEventSocket } from 'src/composables/useEventSocket'

const route = useRoute()
const eventId = route.params.eventId

const leaderboard = ref([])
const eventName = ref('')
const eventDescription = ref('')
const copied = ref(false)

const fetchLeaderboard = async () => {
  try {
    const res = await api.get(`/public/events/${eventId}/leaderboard`)
    leaderboard.value = res.data.leaderboard
    eventName.value = res.data.eventName
    eventDescription.value = res.data.eventDescription
  } catch {
    // Non-critical failure — UI shows stale data
  }
}

const copyLink = () => {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

onMounted(async () => {
  await fetchLeaderboard()
  const { socket } = useEventSocket(eventId)
  socket.on('scan:created', fetchLeaderboard)
})
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }

.public-lb-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #150b24 0%, #2a1060 45%, #8e5add 100%);
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px 40px;
}

/* Header */
.lb-header {
  text-align: center;
  padding: 48px 16px 24px;
}
.lb-icon { font-size: 3.5rem; margin-bottom: 8px; }
.lb-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}
.lb-subtitle {
  font-size: 0.92rem;
  color: rgba(255,255,255,0.7);
  margin-bottom: 4px;
}
.live-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.82rem;
  margin-top: 10px;
}
.dot {
  display: inline-block;
  width: 8px; height: 8px;
  background: var(--q-positive);
  border-radius: 50%;
  animation: pulse 1.4s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Board */
.lb-body {
  width: 100%;
  max-width: 520px;
  margin-top: 12px;
}
.lb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 10px;
  transition: transform .15s;
}
.lb-row:hover { transform: scale(1.01); }
.lb-row.gold   { background: rgba(255,193,7,0.15); border-color: rgba(255,193,7,0.4); }
.lb-row.silver { background: rgba(192,192,192,0.12); border-color: rgba(192,192,192,0.35); }
.lb-row.bronze { background: rgba(205,127,50,0.12); border-color: rgba(205,127,50,0.4); }

.rank { font-size: 1.5rem; min-width: 36px; text-align: center; }
.rank-num { font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.55); }
.team-name { flex: 1; font-size: 1.05rem; font-weight: 600; }
.score { font-size: 1rem; font-weight: 700; color: var(--q-warning); display: flex; align-items: center; gap: 4px; }
.star { font-size: 0.85rem; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255,255,255,0.5);
}
.empty-icon { font-size: 3rem; margin-bottom: 12px; }

/* Footer */
.lb-footer {
  margin-top: 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.copy-btn {
  background: var(--q-primary);
  color: #fff;
  padding: 10px 24px;
  font-size: 0.9rem;
  transition: opacity .2s;
}
.copy-btn:hover { opacity: 0.88; }
.copied-note { color: var(--q-positive); font-size: 0.85rem; }
.refresh-note { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
</style>
