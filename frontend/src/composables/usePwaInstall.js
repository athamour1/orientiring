import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

const deferredPrompt = ref(null)
// We track if we SHOULD auto-prompt
const autoPromptSuppressed = ref(localStorage.getItem('pwaPromptDismissed') === 'true')

export function usePwaInstall() {
  const $q = useQuasar()

  // Check if app is already installed (running in standalone mode)
  const isStandalone = computed(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )

  // Always show the install button unless already installed
  const isInstallable = computed(() => !isStandalone.value)

  // Whether the native browser prompt is available
  const hasNativePrompt = computed(() => !!deferredPrompt.value)

  const promptInstall = async () => {
    if (deferredPrompt.value) {
      // Native prompt available – use it
      deferredPrompt.value.prompt()
      const { outcome } = await deferredPrompt.value.userChoice
      if (outcome !== 'accepted') {
        dismissAutoPrompt()
      }
      deferredPrompt.value = null
    } else {
      // No native prompt – show manual instructions
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const message = isIOS
        ? 'Tap the Share button (⎋) then "Add to Home Screen"'
        : 'Open browser menu (⋮) and tap "Install app" or "Add to Home Screen"'

      $q.dialog({
        title: 'Install Oriento',
        message,
        ok: 'OK'
      })
    }
  }

  const dismissAutoPrompt = () => {
    localStorage.setItem('pwaPromptDismissed', 'true')
    autoPromptSuppressed.value = true
  }

  const setPrompt = (e) => {
    deferredPrompt.value = e
  }

  const clearPrompt = () => {
    deferredPrompt.value = null
  }

  return {
    isInstallable,
    hasNativePrompt,
    autoPromptSuppressed,
    promptInstall,
    dismissAutoPrompt,
    setPrompt,
    clearPrompt
  }
}
