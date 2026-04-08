<template>
  <q-page class="flex flex-center login-page">
    <q-btn
      round flat
      :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
      color="white"
      class="dark-toggle"
      @click="$q.dark.toggle()"
    />
    <div class="main-card q-pa-xl shadow-up-10 rounded-borders">
      <div class="text-center q-mb-lg">
        <div class="row items-center justify-center q-gutter-sm q-mb-xs">
          <img src="/favicon.svg" alt="Oriento" style="width:40px;height:40px;" />
          <h3 class="text-h4 text-weight-bold tracking-tight branded-title q-my-none">Oriento</h3>
        </div>
        <p class="text-subtitle1 text-grey-8 opacity-80 current-status q-mt-sm">{{ $t('targetAndNavigate') }}</p>
      </div>

      <q-form @submit="onSubmit" class="q-gutter-md">
        <q-input
          v-model="username"
          outlined
          color="primary"
          :placeholder="$t('teamIdAdmin')"
          lazy-rules
          :rules="[val => val && val.length > 0 || $t('typeUsername')]"
        >
          <template v-slot:prepend>
            <q-icon name="person" color="primary" />
          </template>
        </q-input>

        <q-input
          v-model="password"
          outlined
          color="primary"
          :type="showPassword ? 'text' : 'password'"
          :placeholder="$t('pinPassword')"
          lazy-rules
          :rules="[val => val !== null && val !== '' || $t('typePassword')]"
        >
          <template v-slot:prepend>
            <q-icon name="lock" color="primary" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="showPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              color="grey-6"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-toggle
          v-model="keepLoggedIn"
          :label="$t('keepMeLoggedIn')"
          color="primary"
          class="q-mt-xs"
        />

        <div class="q-mt-md">
          <q-btn class="full-width" color="primary" text-color="white" :label="$t('commenceHunt')" type="submit" size="lg" unelevated no-caps />
        </div>
      </q-form>
    </div>
    <div class="app-version">v{{ appVersion }}</div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const $q = useQuasar()
const { t } = useI18n()
const appVersion = process.env.APP_VERSION
const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const keepLoggedIn = ref(false)

const onSubmit = async () => {
  try {
    const res = await api.post('/auth/login', {
      username: username.value,
      password: password.value,
      keepLoggedIn: keepLoggedIn.value
    })
    localStorage.setItem('token', res.data.access_token)
    if (!keepLoggedIn.value) {
      localStorage.setItem('sessionOnly', 'true')
      sessionStorage.setItem('sessionActive', 'true')
    } else {
      localStorage.removeItem('sessionOnly')
    }
    if (res.data.role === 'ADMIN') {
      router.push('/admin')
    } else {
      router.push('/team/map')
    }
  } catch (err) {
    let msg = t('authFailed')
    if (err.response && err.response.data && err.response.data.message) {
      msg = err.response.data.message
    }
    $q.notify({
      color: 'negative',
      icon: 'warning',
      message: msg
    })
  }
}
</script>

<style scoped>
.login-page {
  background: linear-gradient(145deg, #150b24 0%, #2a1060 50%, #8e5add 100%);
  min-height: 100vh;
  position: relative;
}
.dark-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  opacity: 0.8;
}
body.body--light .login-page {
  background: linear-gradient(145deg, #f0ebff 0%, #d8c8ff 50%, #c4a0f5 100%);
}

.main-card {
  width: 100%;
  max-width: 400px;
  border-radius: 20px;
  box-shadow: none !important;
  transition: background-color 0.3s, border-color 0.3s;
}

body.body--light .main-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(142, 90, 221, 0.15);
}
body.body--dark .main-card {
  background: rgba(30, 16, 48, 0.55);
  border: 1px solid rgba(196, 160, 245, 0.1);
}

.branded-title {
  color: var(--q-primary);
}

.opacity-80 { opacity: 0.8; }

.app-version {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1rem;
  opacity: 0.5;
  color: #fff;
  letter-spacing: 0.05em;
  pointer-events: none;
}
</style>
