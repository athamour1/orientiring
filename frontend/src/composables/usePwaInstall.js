import { ref, computed, h } from 'vue'
import { useQuasar, QCard, QCardSection, QBtn, QIcon } from 'quasar'

const deferredPrompt = ref(null)
const autoPromptSuppressed = ref(localStorage.getItem('pwaPromptDismissed') === 'true')

export function usePwaInstall() {
  const $q = useQuasar()

  const isStandalone = computed(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )

  const isInstallable = computed(() => !isStandalone.value)
  const hasNativePrompt = computed(() => !!deferredPrompt.value)

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  const showIOSGuide = () => {
    $q.dialog({
      title: '',
      message: '',
      html: true,
      ok: false,
      // Use Quasar's component option to render rich content
      component: {
        setup(_, { emit }) {
          const close = () => emit('ok')
          return () => h('div', { style: 'padding: 8px 4px 4px' }, [
            h('div', { style: 'text-align:center; margin-bottom:16px' }, [
              h('img', { src: '/favicon.svg', style: 'width:48px;height:48px;margin-bottom:8px' }),
              h('div', { style: 'font-size:1.1rem;font-weight:700;margin-bottom:4px' }, 'Install Oriento'),
              h('div', { style: 'font-size:0.85rem;opacity:0.65' }, 'Add to your Home Screen for the best experience'),
            ]),
            h('div', { style: 'display:flex;flex-direction:column;gap:14px;margin-bottom:20px' }, [
              h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
                h('div', { style: 'width:36px;height:36px;border-radius:50%;background:rgba(142,90,221,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0' },
                  h('span', { class: 'material-icons', style: 'font-size:20px;color:#8e5add' }, 'ios_share')
                ),
                h('div', [
                  h('div', { style: 'font-weight:600;font-size:0.9rem' }, 'Tap the Share button'),
                  h('div', { style: 'font-size:0.8rem;opacity:0.6' }, 'At the bottom of Safari\'s toolbar'),
                ]),
              ]),
              h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
                h('div', { style: 'width:36px;height:36px;border-radius:50%;background:rgba(142,90,221,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0' },
                  h('span', { class: 'material-icons', style: 'font-size:20px;color:#8e5add' }, 'add_box')
                ),
                h('div', [
                  h('div', { style: 'font-weight:600;font-size:0.9rem' }, 'Tap "Add to Home Screen"'),
                  h('div', { style: 'font-size:0.8rem;opacity:0.6' }, 'Scroll down in the share menu'),
                ]),
              ]),
              h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
                h('div', { style: 'width:36px;height:36px;border-radius:50%;background:rgba(142,90,221,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0' },
                  h('span', { class: 'material-icons', style: 'font-size:20px;color:#8e5add' }, 'check_circle')
                ),
                h('div', [
                  h('div', { style: 'font-weight:600;font-size:0.9rem' }, 'Tap "Add"'),
                  h('div', { style: 'font-size:0.8rem;opacity:0.6' }, 'Oriento will appear on your home screen'),
                ]),
              ]),
            ]),
            h('button', {
              onClick: close,
              style: 'width:100%;padding:12px;border-radius:999px;background:#8e5add;color:#fff;font-weight:700;font-size:0.95rem;border:none;cursor:pointer'
            }, 'Got it'),
          ])
        },
        emits: ['ok', 'hide'],
      }
    })
  }

  const promptInstall = async () => {
    if (deferredPrompt.value) {
      deferredPrompt.value.prompt()
      const { outcome } = await deferredPrompt.value.userChoice
      if (outcome !== 'accepted') dismissAutoPrompt()
      deferredPrompt.value = null
    } else if (isIOS) {
      showIOSGuide()
    } else {
      $q.dialog({
        title: 'Install Oriento',
        message: 'Open browser menu (⋮) and tap "Install app" or "Add to Home Screen"',
        ok: 'OK'
      })
    }
  }

  const dismissAutoPrompt = () => {
    localStorage.setItem('pwaPromptDismissed', 'true')
    autoPromptSuppressed.value = true
  }

  const setPrompt = (e) => { deferredPrompt.value = e }
  const clearPrompt = () => { deferredPrompt.value = null }

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
