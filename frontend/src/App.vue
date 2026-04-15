<template>
  <ErrorBoundary>
    <router-view />
  </ErrorBoundary>
</template>

<script setup>
import { onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { usePwaInstall } from 'src/composables/usePwaInstall'
import ErrorBoundary from 'src/components/ErrorBoundary.vue'

const $q = useQuasar()
const { setPrompt, clearPrompt, autoPromptSuppressed, promptInstall, dismissAutoPrompt } = usePwaInstall()

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

onMounted(() => {
  // Android/Chrome: capture the native prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setPrompt(e)

    if (autoPromptSuppressed.value) return

    $q.notify({
      color: 'primary',
      icon: 'get_app',
      message: 'Install the Oriento app for the best experience!',
      timeout: 8000,
      position: 'bottom',
      actions: [
        { label: 'Install', color: 'white', handler: () => promptInstall() },
        { label: 'Dismiss', color: 'grey-4', handler: () => dismissAutoPrompt() }
      ]
    })
  })

  // iOS: show a one-time nudge banner since beforeinstallprompt never fires
  if (isIOS && !isStandalone && !autoPromptSuppressed.value) {
    setTimeout(() => {
      $q.notify({
        color: 'primary',
        icon: 'ios_share',
        message: 'Tap Share → "Add to Home Screen" to install Oriento',
        timeout: 8000,
        position: 'bottom',
        actions: [
          { label: 'How?', color: 'white', handler: () => promptInstall() },
          { label: 'Dismiss', color: 'grey-4', handler: () => dismissAutoPrompt() }
        ]
      })
    }, 2000)
  }

  window.addEventListener('appinstalled', clearPrompt)
})
</script>
