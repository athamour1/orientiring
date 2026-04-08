<template>
  <q-layout view="hHh Lpr fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title class="text-weight-bold tracking-tight row items-center q-gutter-xs">
          <img src="/favicon.svg" alt="Oriento" style="width:28px;height:28px;vertical-align:middle;" />
          <span>Oriento</span>
        </q-toolbar-title>
        <q-chip
          v-if="timerVisible"
          dense
          :color="timerColor"
          text-color="white"
          icon="timer"
          class="q-mr-xs text-weight-bold"
          style="font-size:0.72rem;"
        >{{ timerLabel }}</q-chip>
        <q-btn v-if="isInstallable" flat dense round icon="download" @click="promptInstall">
          <q-tooltip>{{ $t('installApp') }}</q-tooltip>
        </q-btn>
        <q-btn flat dense round :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'" @click="toggleDark">
          <q-tooltip>{{ $q.dark.isActive ? 'Light Mode' : 'Dark Mode' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="logout" @click="logout" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer bordered :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'" class="shadow-up-2">
      <q-tabs no-caps active-color="primary" indicator-color="transparent" align="justify" class="text-grey-7" v-model="tab">
        <q-route-tab name="map" icon="map" :label="$t('map')" to="/team/map" exact />
        <q-route-tab v-if="!teamEventStore.allDone" name="scan" icon="qr_code_scanner" :label="$t('scanner')" to="/team/scan" exact />
        <q-route-tab name="leaderboard" icon="leaderboard" :label="$t('leaderboard')" to="/team/leaderboard" exact />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { usePwaInstall } from 'src/composables/usePwaInstall'
import { useTeamEventStore } from 'src/stores/teamEvent'
import { useEventTimer } from 'src/composables/useEventTimer'
const teamEventStore = useTeamEventStore()
const startTime = computed(() => teamEventStore.startTime)
const endTime = computed(() => teamEventStore.endTime)
const { timerLabel, timerColor, timerVisible } = useEventTimer(startTime, endTime)

const $q = useQuasar()
const router = useRouter()
const tab = ref('map')
const { isInstallable, promptInstall } = usePwaInstall()
// Active Event tracking is handled entirely via route nesting now!

const toggleDark = () => {
  $q.dark.toggle()
  localStorage.setItem('darkMode', $q.dark.isActive)
}

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('sessionOnly')
  sessionStorage.removeItem('sessionActive')
  delete api.defaults.headers.common['Authorization']
  router.push('/')
}
</script>

<style scoped>
.tracking-tight { letter-spacing: -0.02em; }
</style>
