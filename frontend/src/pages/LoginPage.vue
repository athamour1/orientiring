<template>
  <q-page class="flex flex-center login-page">
    <q-btn
      round flat
      :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
      :color="$q.dark.isActive ? 'white' : 'primary'"
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
    <div class="bottom-bar">
      <a
        href="https://github.com/athamour1/orientiring"
        target="_blank"
        rel="noopener"
        class="github-link"
      >
        <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/>
        </svg>
        Open Source
      </a>
      <span class="bottom-sep">·</span>
      <span class="app-version">v{{ appVersion }}</span>
    </div>
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

.bottom-bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.github-link {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  letter-spacing: 0.03em;
  transition: color 0.2s;
}
.github-link:hover { color: rgba(255,255,255,0.95); }

.github-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.bottom-sep {
  color: rgba(255,255,255,0.25);
  font-size: 0.8rem;
}

.app-version {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.05em;
}

body.body--light .github-link { color: rgba(142,90,221,0.65); }
body.body--light .github-link:hover { color: var(--q-primary); }
body.body--light .bottom-sep { color: rgba(142,90,221,0.3); }
body.body--light .app-version { color: rgba(142,90,221,0.6); }
</style>
