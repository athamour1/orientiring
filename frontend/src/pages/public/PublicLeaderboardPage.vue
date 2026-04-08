<template>
  <div class="public-lb-page relative-position">
    <q-btn
      round flat
      :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
      color="white"
      class="dark-toggle"
      @click="$q.dark.toggle()"
    />
    <!-- Header -->
    <div class="lb-header">
      <div class="lb-icon">🏆</div>
      <h1 class="lb-title">{{ eventName }}</h1>
      <p class="lb-subtitle" v-if="eventDescription">{{ eventDescription }}</p>
      <p class="lb-subtitle">{{ $t('liveRankings') }}</p>
      <div class="live-dot"><span class="dot"></span> {{ $t('live') }}</div>
      <div v-if="timerVisible" class="timer-chip" :class="`timer-${timerColor}`">
        <span class="timer-icon">⏱</span> {{ timerLabel }}
      </div>
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
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { useEventSocket } from 'src/composables/useEventSocket'
import { useEventTimer } from 'src/composables/useEventTimer'

const $q = useQuasar()

const route = useRoute()
const eventId = route.params.eventId

const leaderboard = ref([])
const eventName = ref('')
const eventDescription = ref('')
const copied = ref(false)
const startTime = ref(null)
const endTime = ref(null)
const { timerLabel, timerColor, timerVisible } = useEventTimer(startTime, endTime)

const fetchLeaderboard = async () => {
  try {
    const res = await api.get(`/public/events/${eventId}/leaderboard`)
    leaderboard.value = res.data.leaderboard
    eventName.value = res.data.eventName
    eventDescription.value = res.data.eventDescription
    startTime.value = res.data.startTime ?? null
    endTime.value = res.data.endTime ?? null
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

.dark-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  opacity: 0.8;
}

.public-lb-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #f0ebff 0%, #d8c8ff 50%, #c4a0f5 100%);
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #1a0d2e;
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
  color: rgba(0,0,0,0.6);
  margin-bottom: 4px;
}
.live-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.07);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.82rem;
  margin-top: 10px;
}
/* Dark mode overrides */
body.body--dark .public-lb-page {
  background: linear-gradient(160deg, #150b24 0%, #2a1060 45%, #8e5add 100%);
  color: #fff;
}
body.body--dark .lb-subtitle { color: rgba(255,255,255,0.7); }
body.body--dark .live-dot { background: rgba(255,255,255,0.1); }
body.body--dark .lb-row {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.14);
}
body.body--dark .rank-num { color: rgba(255,255,255,0.55); }
body.body--dark .empty-state { color: rgba(255,255,255,0.5); }
body.body--dark .refresh-note { color: rgba(255,255,255,0.4); }
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
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(142,90,221,0.2);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 10px;
  transition: transform .15s;
}
.lb-row:hover { transform: scale(1.01); }
.lb-row.gold   { background: rgba(255,193,7,0.2);  border-color: rgba(255,193,7,0.55); }
.lb-row.silver { background: rgba(160,160,180,0.35); border-color: rgba(140,140,170,0.7); }
.lb-row.bronze { background: rgba(205,127,50,0.2);  border-color: rgba(205,127,50,0.55); }

.rank { font-size: 1.5rem; min-width: 36px; text-align: center; }
.rank-num { font-size: 1rem; font-weight: 700; color: rgba(0,0,0,0.45); }
.team-name { flex: 1; font-size: 1.05rem; font-weight: 600; }
.score { font-size: 1rem; font-weight: 700; color: var(--q-warning); display: flex; align-items: center; gap: 4px; }
.star { font-size: 0.85rem; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(0,0,0,0.45);
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
.refresh-note { font-size: 0.75rem; color: rgba(0,0,0,0.35); }

.timer-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 700;
  margin-top: 10px;
  letter-spacing: 0.02em;
}
.timer-chip.timer-positive { background: rgba(33,186,69,0.15); color: #1a8f3a; }
.timer-chip.timer-warning  { background: rgba(240,173,0,0.18);  color: #9a6800; }
.timer-chip.timer-negative { background: rgba(193,0,21,0.13);   color: #b00015; }
body.body--dark .timer-chip.timer-positive { background: rgba(33,186,69,0.22);  color: #4ddb72; }
body.body--dark .timer-chip.timer-warning  { background: rgba(240,173,0,0.22);  color: #ffd04d; }
body.body--dark .timer-chip.timer-negative { background: rgba(193,0,21,0.22);   color: #ff5566; }
</style>
