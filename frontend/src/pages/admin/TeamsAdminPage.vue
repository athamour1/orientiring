<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat round icon="arrow_back" color="grey-8" @click="$router.back()" class="q-mr-sm" />
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('teamManagement') }}</div>
      <q-space />
      <q-btn color="primary" icon="person_add" :label="$t('registerTeam')" unelevated no-caps @click="showDialog = true" />
    </div>

    <q-table :rows="teams" :columns="columns" row-key="id" flat bordered class="shadow-2">
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round color="negative" dense icon="delete" @click="confirmDelete(props.row)" />
        </q-td>
      </template>
    </q-table>

    <!-- Modal -->
    <q-dialog v-model="showDialog">
      <q-card style="min-width: 350px" class="q-pa-sm rounded-borders">
        <q-card-section>
          <div class="text-h6 text-weight-bold">{{ $t('registerNewTeam') }}</div>
          <div class="text-caption text-grey">{{ $t('provideCredentials') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-form @submit="createTeam" class="q-gutter-md">
            <q-input v-model="form.username" :label="$t('teamUsername')" outlined :rules="[val => !!val || 'Required']" />
            <q-input v-model="form.password" :label="$t('teamPassword')" outlined type="password" :rules="[val => !!val || 'Required']" />
            <div class="row justify-end q-mt-md">
              <q-btn flat :label="$t('cancel')" color="grey" v-close-popup no-caps />
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

const columns = computed(() => [
  { name: 'id', required: true, label: t('id'), align: 'left', field: 'id', sortable: true },
  { name: 'username', required: true, label: t('teamUsername'), align: 'left', field: 'username', sortable: true },
  { name: 'actions', label: t('actions'), align: 'right' }
])

const fetchTeams = async () => {
  try {
    const res = await api.get(`/admin/events/${eventId}/teams`)
    teams.value = res.data
  } catch { /* silent */ }
}

onMounted(() => {
  fetchTeams()
})

const createTeam = async () => {
  try {
    await api.post(`/admin/events/${eventId}/teams`, form.value)
    showDialog.value = false
    form.value = { username: '', password: '' }
    fetchTeams()
  } catch(e) {
    const msg = e.response?.data?.message || 'Error creating team'
    void msg
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
    } catch { /* silent */ }
  })
}
</script>
