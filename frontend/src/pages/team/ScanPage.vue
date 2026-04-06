<template>
  <q-page class="flex flex-center">
    <div class="full-width q-pa-md text-center max-w-sm main-card rounded-borders shadow-2">
      <h5 class="q-mt-md q-mb-lg text-weight-bold tracking-tight branded-title">{{ $t('scanCheckpoint') }}</h5>

      <div v-if="scanning" class="scanner-wrapper rounded-borders overflow-hidden shadow-4 relative-position bg-dark q-mb-md">
         <qrcode-stream @detect="onDetect" @error="onError"></qrcode-stream>
      </div>
      
      <div v-else class="q-my-lg text-negative">
        <q-icon name="videocam_off" size="3rem" class="q-mb-sm" />
        <div class="text-subtitle1">{{ $t('scanner') }} Error</div>
      </div>

      <div v-if="resultMessage" class="q-mt-md text-subtitle1 q-pa-md rounded-borders" :class="isSuccess ? 'bg-green-1 text-positive' : 'bg-red-1 text-negative'">
        <q-icon :name="isSuccess ? 'check_circle' : 'warning'" size="sm" class="q-mr-sm" />
        {{ resultMessage }}
      </div>
      
      <div v-else class="q-mt-md text-caption text-grey-8">
        {{ $t('cameraAlwaysOnMessage') }}
      </div>
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

const processScan = async (qrSecretString) => {
  try {
    const res = await api.post('/team/scans', { qrSecretString })
    isSuccess.value = true
    
    const cpName = res.data.checkpoint?.name || t('checkpointText')
    const cpPoints = res.data.checkpoint?.pointValue || 10
    
    resultMessage.value = t('targetAcquired', { cpName, points: cpPoints })
    $q.notify({ color: 'positive', icon: 'emoji_events', message: t('checkpointSuccessfullyValidated') })
  } catch(err) {
    isSuccess.value = false
    const msg = err.response?.data?.message || t('validationFailed')
    resultMessage.value = msg
    $q.notify({ color: 'negative', icon: 'error', message: msg })
  }
}

const onDetect = async (detectedCodes) => {
  if (isProcessing || detectedCodes.length === 0) return
  isProcessing = true
  
  let rawValue = detectedCodes[0].rawValue
  if (rawValue.includes('qr=')) {
    rawValue = rawValue.split('qr=')[1].split('&')[0]
  }
  await processScan(rawValue)
  
  // Prevent duplicate immediate scans by adding a cooldown
  setTimeout(() => {
    isProcessing = false
  }, 4000)
}

const onError = () => {
  isSuccess.value = false
  resultMessage.value = t('cameraAccessError')
  scanning.value = false
}
</script>

<style scoped>
.main-card {
  transition: background-color 0.3s, border-color 0.3s;
}
body.body--light .main-card {
  background: #ffffff;
  border: 1px solid #e0e0e0;
}
body.body--dark .main-card {
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

body.body--light .branded-title {
  color: #1A1A2E; 
}
body.body--dark .branded-title {
  color: #ffffff;
}

.scanner-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}
.max-w-sm {
  max-width: 400px;
  margin: 0 auto;
}
.tracking-tight {
  letter-spacing: -0.02em;
}
</style>
