<template>
  <q-page class="scan-page">
    <!-- Full-screen camera -->
    <qrcode-stream v-if="!cameraBlocked && !scanResult" @detect="onDetect" @error="onError" class="camera-stream" />

    <!-- Camera denied card -->
    <transition name="fade">
      <div v-if="cameraBlocked" class="cam-overlay">
        <div class="cam-card">
          <div class="cam-icon">📷</div>
          <div class="cam-title">{{ $t('cameraRequired') }}</div>
          <div class="cam-body">{{ permissionDenied ? $t('cameraPermissionDenied') : $t('cameraAccessError') }}</div>
          <div v-if="permissionDenied" class="cam-hint">{{ $t('cameraEnableHint') }}</div>
          <q-btn
            unelevated rounded color="primary" size="lg" no-caps
            :label="$t('retryCamera')"
            :loading="retrying"
            class="q-mt-lg full-width"
            @click="retry"
          />
        </div>
      </div>
    </transition>

    <!-- Scan result card -->
    <transition name="slide-up">
      <div v-if="scanResult" class="result-overlay">
        <div class="result-card">
          <div class="result-icon">{{ scanResult.success ? '✅' : (scanResult.alreadyScanned ? '🔁' : '❌') }}</div>
          <div class="result-title">{{ scanResult.title }}</div>
          <div class="result-body">{{ scanResult.body }}</div>
          <div v-if="scanResult.bonus" class="result-bonus">
            <q-icon name="stars" color="warning" size="sm" />
            {{ $t('firstScanBonus', { bonus: scanResult.bonus }) }}
          </div>
          <q-btn
            unelevated flat no-caps
            color="primary"
            size="lg"
            icon="map"
            :label="$t('backToMap')"
            class="q-mt-lg full-width back-btn"
            @click="goToMap"
          />
        </div>
      </div>
    </transition>

    <!-- Hint bar when camera is active -->
    <div v-if="!scanResult && !cameraBlocked" class="status-bar">
      <div class="hint-text text-center">{{ $t('cameraAlwaysOnMessage') }}</div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QrcodeStream } from 'vue-qrcode-reader'
import { api } from 'boot/axios'
import { useI18n } from 'vue-i18n'
import { useTeamEventStore } from 'src/stores/teamEvent'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const teamEventStore = useTeamEventStore()
const cameraBlocked = ref(false)
const permissionDenied = ref(false)
const retrying = ref(false)
const scanResult = ref(null)
let isProcessing = false

onMounted(() => {
  if (teamEventStore.eventStatus === 'pending') {
    router.replace('/team/lobby')
    return
  }
  if (route.query.qr) {
    processScan(route.query.qr)
  }
})

const processScan = async (qrSecretString) => {
  try {
    const res = await api.post('/team/scans', { qrSecretString })
    const cpName = res.data.checkpoint?.name || t('checkpointText')
    const cpPoints = res.data.checkpoint?.pointValue || 10
    const bonus = res.data.bonusAwarded || 0
    scanResult.value = {
      success: true,
      alreadyScanned: false,
      title: t('targetAcquired', { cpName, points: cpPoints + bonus }),
      body: `+${cpPoints + bonus} pts`,
      bonus: bonus > 0 ? bonus : null,
    }
  } catch (err) {
    const status = err.response?.status
    const msg = err.response?.data?.message || t('validationFailed')
    scanResult.value = {
      success: false,
      alreadyScanned: status === 409,
      title: status === 409 ? t('alreadyScanned') : t('validationFailed'),
      body: msg,
      bonus: null,
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

const onError = (err) => {
  permissionDenied.value = err?.name === 'NotAllowedError'
  cameraBlocked.value = true
  retrying.value = false
}

const retry = () => {
  retrying.value = true
  cameraBlocked.value = false
  setTimeout(() => { retrying.value = false }, 2000)
}

const goToMap = () => {
  scanResult.value = null
  isProcessing = false
  router.push('/team/map')
}
</script>

<style scoped>
.scan-page {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: hidden;
  padding: 0 !important;
}

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

/* Camera blocked overlay */
.cam-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.cam-card {
  background: #1a1a2e;
  border: 1px solid rgba(142, 90, 221, 0.3);
  border-radius: 20px;
  padding: 36px 28px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  color: #fff;
}

.cam-icon { font-size: 3.5rem; margin-bottom: 16px; }
.cam-title { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
.cam-body { font-size: 0.9rem; color: rgba(255,255,255,0.75); line-height: 1.5; margin-bottom: 6px; }
.cam-hint { font-size: 0.78rem; color: rgba(255,255,255,0.5); line-height: 1.4; margin-top: 10px; }

/* Scan result overlay */
.result-overlay {
  position: absolute;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.result-card {
  background: #150b24;
  border: 1px solid rgba(142, 90, 221, 0.2);
  border-radius: 24px;
  padding: 40px 28px 28px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  color: #fff;
}

.result-icon { font-size: 4rem; margin-bottom: 16px; }

.result-title {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  color: #fff;
}

.result-body {
  font-size: 2rem;
  font-weight: 700;
  color: #c4a0f5;
  margin-bottom: 8px;
}

.result-bonus {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 193, 7, 0.12);
  border: 1px solid rgba(255, 193, 7, 0.25);
  border-radius: 999px;
  padding: 4px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #ffd54f;
  margin-top: 4px;
}

.back-btn {
  border: 1px solid rgba(142, 90, 221, 0.3);
  border-radius: 999px !important;
}

/* Hint bar */
.status-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.75);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
}

.hint-text {
  font-size: 0.82rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.7);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-up-leave-active { transition: all 0.2s ease-in; }
.slide-up-enter-from { opacity: 0; transform: translateY(40px); }
.slide-up-leave-to { opacity: 0; transform: translateY(20px); }
</style>
