<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('teamManagement') }}</div>
      <q-space />
      <q-btn color="primary" icon="person_add" :label="$t('registerTeam')" unelevated no-caps @click="showDialog = true" />
    </div>

    <q-card flat bordered class="shadow-2">
      <q-table :rows="teams" :columns="columns" row-key="id" flat class="admin-table">
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round color="negative" dense icon="delete" @click="confirmDelete(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Modal -->
    <q-dialog v-model="showDialog" @hide="onDialogHide">
      <q-card style="min-width: 380px" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('registerNewTeam') }}</div>
          <div class="text-caption text-grey-7">{{ $t('provideCredentials') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-form @submit="createTeam" class="q-gutter-md">
            <q-input
              v-model="form.username"
              :label="$t('teamUsername')"
              outlined
              :error="!!usernameError"
              :error-message="usernameError"
              :rules="[val => !!val || 'Required']"
              @update:model-value="checkUsername($event)"
            >
              <template v-slot:append>
                <q-spinner v-if="usernameChecking" color="grey-5" size="18px" />
                <q-icon v-else-if="usernameAvailable === true" name="check_circle" color="positive" />
                <q-icon v-else-if="usernameAvailable === false" name="cancel" color="negative" />
              </template>
            </q-input>
            <q-input v-model="form.password" :label="$t('teamPassword')" outlined type="password" :rules="[val => !!val || 'Required']" />
            <div class="row justify-end q-mt-md q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('register')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const eventId = route.params.eventId

const teams = ref([])
const showDialog = ref(false)
const form = ref({ username: '', password: '' })
const usernameError = ref('')
const usernameChecking = ref(false)
const usernameAvailable = ref(null) // null = unchecked, true = free, false = taken

let debounceTimer = null
const checkUsername = (val) => {
  usernameAvailable.value = null
  usernameError.value = ''
  if (!val || val.length < 2) return
  usernameChecking.value = true
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    try {
      const res = await api.get(`/admin/events/${eventId}/teams/check-username`, { params: { username: val } })
      usernameAvailable.value = !res.data.taken
      if (res.data.taken) usernameError.value = t('usernameTaken')
    } catch { /* ignore */ } finally {
      usernameChecking.value = false
    }
  }, 400)
}

const columns = computed(() => [
  { name: 'id', required: true, label: t('id'), align: 'left', field: 'id', sortable: true },
  { name: 'username', required: true, label: t('teamUsername'), align: 'left', field: 'username', sortable: true },
  { name: 'actions', label: t('actions'), align: 'right' }
])

const fetchTeams = async () => {
  try {
    const res = await api.get(`/admin/events/${eventId}/teams`)
    teams.value = res.data
  } catch (err) { console.error(err) }
}

onMounted(() => {
  fetchTeams()
})

const onDialogHide = () => {
  form.value = { username: '', password: '' }
  usernameError.value = ''
  usernameAvailable.value = null
  usernameChecking.value = false
  clearTimeout(debounceTimer)
}

const createTeam = async () => {
  try {
    await api.post(`/admin/events/${eventId}/teams`, form.value)
    showDialog.value = false
    form.value = { username: '', password: '' }
    usernameError.value = ''
    fetchTeams()
  } catch (e) {
    if (e.response?.status === 409) {
      usernameError.value = t('usernameTaken')
    } else {
      $q.notify({ type: 'negative', message: e.response?.data?.message || t('failedToSaveSettings'), position: 'top-right', timeout: 2500 })
    }
  }
}

const confirmDelete = (team) => {
  $q.dialog({
    title: t('confirmDeletion'),
    message: `Are you sure you want to permanently delete team '${team.username}'? All their scans and location data will be wiped.`,
    ok: { color: 'negative', label: 'Delete', noCaps: true },
    cancel: { color: 'grey', noCaps: true, flat: true }
  }).onOk(async () => {
    try {
      await api.delete(`/admin/events/${eventId}/teams/${team.id}`)
      fetchTeams()
    } catch (err) { console.error(err) }
  })
}
</script>

<style scoped>
.admin-page { max-width: 900px; margin: 0 auto; }
.tracking-tight { letter-spacing: -0.02em; }
</style>
