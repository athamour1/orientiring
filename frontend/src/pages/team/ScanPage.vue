<template>
  <q-page class="scan-page">
    <!-- Full-screen camera -->
    <div class="camera-area">
      <qrcode-stream v-if="scanning" @detect="onDetect" @error="onError" class="camera-stream" />
      <div v-else class="camera-error flex flex-center column text-white">
        <q-icon name="videocam_off" size="4rem" class="q-mb-md" />
        <div class="text-h6">{{ $t('cameraAccessError') }}</div>
      </div>

      <!-- Overlay: corner frame -->
      <div class="scan-frame" />
    </div>

    <!-- Bottom status bar -->
    <div class="status-bar q-px-lg q-py-md">
      <transition name="fade" mode="out-in">
        <div v-if="resultMessage" :key="resultMessage"
          class="result-pill row items-center q-gutter-sm"
          :class="isSuccess ? 'result-success' : 'result-error'"
        >
          <q-icon :name="isSuccess ? 'check_circle' : 'warning'" size="sm" />
          <span>{{ resultMessage }}</span>
        </div>
        <div v-else class="hint-text text-center text-grey-5">
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
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #000;
  overflow: hidden;
}

.camera-area {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.camera-stream {
  width: 100%;
  height: 100%;
}

/* Pierce into QrcodeStream's internal elements */
.camera-stream :deep(video),
.camera-stream :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block;
}

/* The wrapper div QrcodeStream renders */
.camera-stream :deep(> div) {
  width: 100%;
  height: 100%;
}

.camera-error {
  width: 100%;
  height: 100%;
  background: #111;
}

/* Corner-bracket scan frame */
.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  width: min(70vw, 260px);
  height: min(70vw, 260px);
  border-radius: 12px;
  pointer-events: none;
}
.scan-frame::before,
.scan-frame::after,
.scan-frame > *,
.scan-frame {
  box-sizing: border-box;
}
.scan-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 3px solid rgba(255,255,255,0.15);
  border-radius: 12px;
}
/* Four corner brackets via box-shadow trick */
.scan-frame::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  background:
    linear-gradient(white, white) top    left  / 24px 3px no-repeat,
    linear-gradient(white, white) top    left  / 3px 24px no-repeat,
    linear-gradient(white, white) top    right / 24px 3px no-repeat,
    linear-gradient(white, white) top    right / 3px 24px no-repeat,
    linear-gradient(white, white) bottom left  / 24px 3px no-repeat,
    linear-gradient(white, white) bottom left  / 3px 24px no-repeat,
    linear-gradient(white, white) bottom right / 24px 3px no-repeat,
    linear-gradient(white, white) bottom right / 3px 24px no-repeat;
}

/* Bottom status area */
.status-bar {
  background: rgba(0, 0, 0, 0.82);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-pill {
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 0.95rem;
}
.result-success { background: rgba(67,160,71,0.25); color: #a5d6a7; }
.result-error   { background: rgba(229,57,53,0.25);  color: #ef9a9a; }

.hint-text {
  font-size: 0.82rem;
  line-height: 1.4;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
