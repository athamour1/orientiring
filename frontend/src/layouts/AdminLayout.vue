<template>
  <q-layout view="hHh Lpr lFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />
        <q-toolbar-title class="text-weight-bold tracking-tight row items-center q-gutter-xs">
          <img src="/favicon.svg" alt="Oriento" style="width:28px;height:28px;vertical-align:middle;" />
          <span>{{ $t('adminDashboard') }}</span>
        </q-toolbar-title>
        <q-btn v-if="isInstallable" flat dense round icon="download" @click="promptInstall">
          <q-tooltip>{{ $t('installApp') }}</q-tooltip>
        </q-btn>
        <q-btn flat dense round :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'" @click="toggleDark">
          <q-tooltip>{{ $q.dark.isActive ? 'Light Mode' : 'Dark Mode' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="logout" @click="logout" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <q-list padding>
        <q-item clickable v-ripple to="/admin" exact>
          <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
          <q-item-section>{{ $t('eventsDashboard') }}</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/admin/profile" exact>
          <q-item-section avatar><q-icon name="manage_accounts" /></q-item-section>
          <q-item-section>{{ $t('profileSettings') }}</q-item-section>
        </q-item>
        
        <q-separator class="q-my-md" />
        <q-item-label header>{{ $t('scavengerHunts') }}</q-item-label>

        <q-expansion-item
          v-for="event in activeEvents"
          :key="event.id"
          expand-separator
          icon="emoji_events"
          :label="event.name"
          :caption="event.isActive ? $t('statusActive') : $t('statusDraft')"
        >
          <q-list class="q-pl-md text-grey-8">
            <q-item clickable v-ripple :to="`/admin/events/${event.id}`" exact>
              <q-item-section avatar><q-icon name="place" size="sm" /></q-item-section>
              <q-item-section>{{ $t('checkpoints') }}</q-item-section>
            </q-item>
            
            <q-item clickable v-ripple :to="`/admin/events/${event.id}/teams`" exact>
              <q-item-section avatar><q-icon name="group" size="sm" /></q-item-section>
              <q-item-section>{{ $t('teamManagement') }}</q-item-section>
            </q-item>
            
            <q-item clickable v-ripple :to="`/admin/events/${event.id}/logs`" exact>
              <q-item-section avatar><q-icon name="history" size="sm" /></q-item-section>
              <q-item-section>{{ $t('activityFeed') }}</q-item-section>
            </q-item>
            
            <q-item clickable v-ripple :to="`/admin/events/${event.id}/settings`" exact>
              <q-item-section avatar><q-icon name="settings" size="sm" /></q-item-section>
              <q-item-section>{{ $t('eventSettings') }}</q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>

      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view :key="$route.params.eventId ?? $route.path" />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useEventsStore } from 'src/stores/events'
import { usePwaInstall } from 'src/composables/usePwaInstall'
import { api } from 'boot/axios'

const $q = useQuasar()
const { locale } = useI18n()
const leftDrawerOpen = ref(false)
const router = useRouter()
const store = useEventsStore()
const activeEvents = computed(() => store.events)
const { isInstallable, promptInstall } = usePwaInstall()

const toggleLeftDrawer = () => { leftDrawerOpen.value = !leftDrawerOpen.value }

const toggleDark = () => {
  $q.dark.toggle()
  localStorage.setItem('darkMode', $q.dark.isActive)
}

onMounted(async () => {
  if (!store.loaded) store.fetchEvents()
  try {
    const res = await api.get('/auth/profile')
    if (res.data?.language) {
      locale.value = res.data.language
      localStorage.setItem('appLang', res.data.language)
    }
  } catch { /* non-critical */ }
})

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
.min-h-screen { min-height: 100vh; }
</style>
