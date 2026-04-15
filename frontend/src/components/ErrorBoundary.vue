<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary fullscreen column items-center justify-center text-center q-pa-xl">
    <q-icon name="error_outline" size="80px" color="negative" />
    <h4 class="q-mt-md q-mb-sm text-weight-bold">{{ $t('somethingWentWrong') }}</h4>
    <p class="text-body1 text-grey q-mb-lg" style="max-width: 400px">
      {{ $t('errorDescription') }}
    </p>
    <q-btn
      color="primary"
      :label="$t('reloadPage')"
      icon="refresh"
      size="lg"
      rounded
      unelevated
      @click="reload"
    />
    <q-expansion-item
      v-if="errorInfo"
      class="q-mt-lg text-left"
      :label="$t('errorDetails')"
      dense
      header-class="text-grey"
      style="max-width: 500px; width: 100%"
    >
      <pre class="q-pa-sm text-caption text-negative" style="white-space: pre-wrap; word-break: break-all">{{ errorInfo }}</pre>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorInfo = ref('')

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorInfo.value = `${err.message || err}\n\nComponent: ${info}`
  console.error('[ErrorBoundary]', err, info)
  return false // prevent further propagation
})

function reload () {
  window.location.reload()
}
</script>

<style scoped>
.error-boundary {
  background: var(--q-dark-page, #fff);
}
</style>
