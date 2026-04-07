<template>
  <q-page class="scan-page">
    <!-- Full-screen camera -->
    <qrcode-stream v-if="scanning" @detect="onDetect" @error="onError" class="camera-stream" />
    <div v-else class="camera-error flex flex-center column text-white">
      <q-icon name="videocam_off" size="4rem" class="q-mb-md" />
      <div class="text-h6">{{ $t('cameraAccessError') }}</div>
    </div>

    <!-- Status bar pinned to bottom -->
    <div class="status-bar">
      <transition name="fade" mode="out-in">
        <div v-if="resultMessage" :key="resultMessage"
          class="result-pill row items-center q-gutter-xs"
          :class="isSuccess ? 'result-success' : 'result-error'"
        >
          <q-icon :name="isSuccess ? 'check_circle' : 'warning'" size="xs" />
          <span>{{ resultMessage }}</span>
        </div>
        <div v-else class="hint-text text-center text-grey-4">
          {{ $t('cameraAlwaysOnMessage') }}
        </div>
      </transition>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { QrcodeStream } from 'vue-qrcode-reader'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const scanning = ref(true)
const resultMessage = ref('')
const isSuccess = ref(false)
let isProcessing = false

onMounted(() => {
  if (route.query.qr) {
    processScan(route.query.qr)
  }
})

const notify = (opts) => $q.notify({ position: 'top-right', timeout: 3500, ...opts })

const processScan = async (qrSecretString) => {
  try {
    const res = await api.post('/team/scans', { qrSecretString })
    isSuccess.value = true
    const cpName = res.data.checkpoint?.name || t('checkpointText')
    const cpPoints = res.data.checkpoint?.pointValue || 10
    const bonus = res.data.bonusAwarded || 0
    resultMessage.value = t('targetAcquired', { cpName, points: cpPoints + bonus })
    if (bonus > 0) {
      notify({ color: 'warning', icon: 'stars', message: t('firstScanBonus', { bonus }) })
    } else {
      notify({ color: 'positive', icon: 'emoji_events', message: t('checkpointSuccessfullyValidated') })
    }
  } catch (err) {
    isSuccess.value = false
    const status = err.response?.status
    const msg = err.response?.data?.message || t('validationFailed')
    resultMessage.value = msg
    if (status === 409) {
      // Already scanned this checkpoint
      notify({ color: 'orange', icon: 'replay', message: t('alreadyScanned') })
    } else {
      notify({ color: 'negative', icon: 'error', message: t('validationFailed') })
    }
  }
}

const onDetect = async (detectedCodes) => {
  if (isProcessing || detectedCodes.length === 0) return
  isProcessing = true
  let rawValue = detectedCodes[0].rawValue
  if (rawValue.includes('qr=')) rawValue = rawValue.split('qr=')[1].split('&')[0]
  await processScan(rawValue)
  setTimeout(() => { isProcessing = false }, 4000)
}

const onError = () => {
  isSuccess.value = false
  resultMessage.value = t('cameraAccessError')
  scanning.value = false
}
</script>

<style scoped>
.scan-page {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: hidden;
  /* Quasar adds padding-bottom for the footer — remove it */
  padding: 0 !important;
}

/* Camera fills the whole page */
.camera-stream {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.camera-stream :deep(video),
.camera-stream :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block;
}

.camera-stream :deep(> div) {
  width: 100%;
  height: 100%;
}

.camera-error {
  position: absolute;
  inset: 0;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #fff;
}

/* Status bar floats above the tab bar */
.status-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.88);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
}

.result-pill {
  border-radius: 20px;
  padding: 5px 14px;
  font-weight: 600;
  font-size: 0.85rem;
}
.result-success { background: rgba(67,160,71,0.3); color: #a5d6a7; }
.result-error   { background: rgba(229,57,53,0.3);  color: #ef9a9a; }

.hint-text {
  font-size: 0.82rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.9);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
