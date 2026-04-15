<template>
  <q-page class="q-pa-lg admin-page">
    <div class="row items-center q-mb-xl">
      <div class="text-h5 text-weight-bold tracking-tight">{{ $t('teamManagement') }}</div>
      <q-space />
      <q-btn outline color="primary" icon="upload_file" :label="$t('importCsv')" no-caps class="q-mr-sm" @click="showImportDialog = true" />
      <q-btn color="primary" icon="person_add" :label="$t('registerTeam')" unelevated no-caps @click="showDialog = true" />
    </div>

    <q-card flat bordered class="shadow-2">
      <q-table :rows="tableLoading ? skeletonRows : teams" :columns="columns" row-key="id" flat class="admin-table">
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <q-skeleton v-if="tableLoading" type="text" />
              <template v-else-if="col.name === 'actions'">
                <q-btn flat round color="secondary" dense icon="edit" class="q-mr-xs" @click="openEdit(props.row)" />
                <q-btn flat round color="negative" dense icon="delete" @click="confirmDelete(props.row)" />
              </template>
              <template v-else>{{ col.value }}</template>
            </q-td>
          </q-tr>
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
            <q-input v-model="form.password" :label="$t('teamPassword')" outlined :type="showCreatePwd ? 'text' : 'password'" :rules="[val => !!val || 'Required']">
              <template v-slot:append>
                <q-icon :name="showCreatePwd ? 'visibility_off' : 'visibility'" class="cursor-pointer" color="grey-6" @click="showCreatePwd = !showCreatePwd" />
              </template>
            </q-input>
            <div class="row justify-end q-mt-md q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('register')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
    <!-- Edit Modal -->
    <q-dialog v-model="showEditDialog" @hide="onEditHide">
      <q-card style="min-width: 380px; border-radius: 16px;" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('editTeam') }}</div>
          <div class="text-caption text-grey-7">{{ $t('leaveBlankToKeep') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-form @submit="saveEdit" class="q-gutter-md">
            <q-input
              v-model="editForm.username"
              :label="$t('teamUsername')"
              outlined
              :error="!!editUsernameError"
              :error-message="editUsernameError"
              :rules="[val => !!val || 'Required']"
              @update:model-value="checkEditUsername($event)"
            >
              <template v-slot:append>
                <q-spinner v-if="editChecking" color="grey-5" size="18px" />
                <q-icon v-else-if="editAvailable === true" name="check_circle" color="positive" />
                <q-icon v-else-if="editAvailable === false" name="cancel" color="negative" />
              </template>
            </q-input>
            <q-input v-model="editForm.password" :label="$t('newPassword')" outlined :type="showEditPwd ? 'text' : 'password'" :hint="$t('leaveBlankToKeep')">
              <template v-slot:append>
                <q-icon :name="showEditPwd ? 'visibility_off' : 'visibility'" class="cursor-pointer" color="grey-6" @click="showEditPwd = !showEditPwd" />
              </template>
            </q-input>
            <div class="row justify-end q-mt-md q-gutter-sm">
              <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup no-caps />
              <q-btn unelevated :label="$t('saveChanges')" color="primary" type="submit" no-caps />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- CSV Import Modal -->
    <q-dialog v-model="showImportDialog" @hide="onImportHide" persistent>
      <q-card style="min-width: 520px; max-width: 600px; border-radius: 16px;" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6 text-weight-bold tracking-tight">{{ $t('importTeams') }}</div>
        </q-card-section>

        <!-- Step indicator -->
        <q-card-section class="q-pt-none q-pb-sm">
          <q-stepper v-model="importStep" flat animated header-nav alternative-labels color="primary" style="box-shadow:none;">
            <q-step :name="1" :title="$t('input')" icon="edit_note" :done="importStep > 1">
              <div class="text-caption text-grey-7 q-mb-md">{{ $t('csvFormatHint') }}</div>

              <!-- Toggle: File or Paste -->
              <q-btn-toggle
                v-model="inputMode"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                class="q-mb-md"
                :options="[
                  { label: $t('uploadFile'), value: 'file', icon: 'upload_file' },
                  { label: $t('pasteText'), value: 'paste', icon: 'content_paste' }
                ]"
              />

              <!-- File upload -->
              <q-file
                v-if="inputMode === 'file'"
                v-model="csvFile"
                :label="$t('selectCsvFile')"
                outlined
                accept=".csv"
                @update:model-value="onFileSelected"
              >
                <template v-slot:prepend>
                  <q-icon name="attach_file" />
                </template>
              </q-file>

              <!-- Text paste -->
              <q-input
                v-if="inputMode === 'paste'"
                v-model="pasteText"
                type="textarea"
                outlined
                :placeholder="'username,password\nteam1,pass123\nteam2,secret456'"
                rows="6"
                autogrow
                style="font-family: monospace; font-size: 13px;"
              />

              <q-stepper-navigation class="row justify-end q-gutter-sm q-mt-sm">
                <q-btn flat :label="$t('cancel')" color="grey-7" no-caps @click="showImportDialog = false" />
                <q-btn
                  unelevated
                  :label="$t('parseData')"
                  color="primary"
                  no-caps
                  icon-right="chevron_right"
                  :disable="inputMode === 'file' ? !csvFile : !pasteText.trim()"
                  @click="parseAndNext"
                />
              </q-stepper-navigation>
            </q-step>

            <q-step :name="2" :title="$t('preview')" icon="table_chart" :done="importStep > 2">
              <div v-if="parseError" class="text-negative q-mb-md">
                <q-icon name="error" class="q-mr-xs" />{{ parseError }}
              </div>

              <div v-if="csvRows.length" class="q-mb-sm">
                <div class="text-subtitle2 q-mb-xs">{{ csvRows.length }} {{ $t('teams').toLowerCase() }}</div>
                <q-table
                  :rows="csvRows"
                  :columns="csvColumns"
                  row-key="username"
                  flat
                  bordered
                  dense
                  :rows-per-page-options="[0]"
                  hide-bottom
                  style="max-height: 300px; overflow: auto;"
                />
              </div>

              <q-stepper-navigation class="row justify-end q-gutter-sm q-mt-sm">
                <q-btn flat :label="$t('back')" color="grey-7" no-caps @click="importStep = 1" />
                <q-btn
                  unelevated
                  :label="$t('importTeams')"
                  color="primary"
                  no-caps
                  icon-right="cloud_upload"
                  :disable="csvRows.length === 0"
                  @click="doImport"
                />
              </q-stepper-navigation>
            </q-step>

            <q-step :name="3" :title="$t('importResults')" icon="check_circle">
              <div v-for="r in importResults" :key="r.username" class="row items-center q-py-xs" style="font-size: 13px;">
                <q-icon :name="r.success ? 'check_circle' : 'cancel'" :color="r.success ? 'positive' : 'negative'" size="18px" class="q-mr-xs" />
                <span class="text-weight-medium">{{ r.username }}</span>
                <span v-if="r.error" class="text-grey-6 q-ml-xs">— {{ r.error }}</span>
              </div>

              <q-stepper-navigation class="row justify-end q-gutter-sm q-mt-md">
                <q-btn flat :label="$t('importMore')" color="grey-7" no-caps @click="resetImport" />
                <q-btn unelevated :label="$t('close')" color="primary" no-caps @click="showImportDialog = false" />
              </q-stepper-navigation>
            </q-step>
          </q-stepper>
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
const tableLoading = ref(true)
const skeletonRows = Array.from({ length: 4 }, (_, i) => ({ id: i }))
const showDialog = ref(false)
const showCreatePwd = ref(false)
const form = ref({ username: '', password: '' })
const usernameError = ref('')
const usernameChecking = ref(false)
const usernameAvailable = ref(null)

const showEditDialog = ref(false)
const showEditPwd = ref(false)
const editForm = ref({ id: null, username: '', password: '' })
const editUsernameError = ref('')
const editChecking = ref(false)
const editAvailable = ref(null)
let editDebounce = null

const checkEditUsername = (val) => {
  editAvailable.value = null
  editUsernameError.value = ''
  if (!val || val.length < 2) return
  editChecking.value = true
  clearTimeout(editDebounce)
  editDebounce = setTimeout(async () => {
    try {
      const res = await api.get(`/admin/events/${eventId}/teams/check-username`, { params: { username: val } })
      const taken = res.data.taken && val !== editForm.value._originalUsername
      editAvailable.value = !taken
      if (taken) editUsernameError.value = t('usernameTaken')
    } catch { /* ignore */ } finally {
      editChecking.value = false
    }
  }, 400)
}

const openEdit = (team) => {
  editForm.value = { id: team.id, username: team.username, password: '', _originalUsername: team.username }
  editAvailable.value = null
  editUsernameError.value = ''
  showEditPwd.value = false
  showEditDialog.value = true
}

const onEditHide = () => {
  editForm.value = { id: null, username: '', password: '', _originalUsername: '' }
  editUsernameError.value = ''
  editAvailable.value = null
  editChecking.value = false
  clearTimeout(editDebounce)
}

const saveEdit = async () => {
  try {
    const payload = { username: editForm.value.username }
    if (editForm.value.password) payload.password = editForm.value.password
    await api.put(`/admin/events/${eventId}/teams/${editForm.value.id}`, payload)
    showEditDialog.value = false
    fetchTeams()
    $q.notify({ type: 'positive', message: t('teamUpdated'), position: 'top-right', timeout: 2000 })
  } catch (e) {
    if (e.response?.status === 409) {
      editUsernameError.value = t('usernameTaken')
    } else {
      $q.notify({ type: 'negative', message: e.response?.data?.message || t('failedToSaveSettings'), position: 'top-right', timeout: 2500 })
    }
  }
}

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
  tableLoading.value = true
  try {
    const res = await api.get(`/admin/events/${eventId}/teams`)
    teams.value = res.data
  } catch (err) { console.error(err) }
  finally { tableLoading.value = false }
}

onMounted(() => {
  fetchTeams()
})

const onDialogHide = () => {
  form.value = { username: '', password: '' }
  usernameError.value = ''
  usernameAvailable.value = null
  usernameChecking.value = false
  showCreatePwd.value = false
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

// ─── CSV Import ───────────────────────────────────────────────────────────
const showImportDialog = ref(false)
const importStep = ref(1)
const inputMode = ref('paste')
const csvFile = ref(null)
const pasteText = ref('')
const csvRows = ref([])
const parseError = ref('')
const importing = ref(false)
const importResults = ref([])
const csvColumns = [
  { name: 'username', label: 'Username', field: 'username', align: 'left' },
  { name: 'password', label: 'Password', field: 'password', align: 'left' },
]

function parseTextToRows(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const rows = []
  for (const line of lines) {
    // Support comma, semicolon, or tab as delimiter
    const cols = line.split(/[,;\t]/).map(c => c.trim())
    if (cols.length < 2) continue
    if (cols[0].toLowerCase() === 'username' && cols[1].toLowerCase() === 'password') continue
    if (cols[0] && cols[1]) {
      rows.push({ username: cols[0], password: cols[1] })
    }
  }
  return rows
}

const onFileSelected = (file) => {
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { pasteText.value = e.target.result }
  reader.readAsText(file)
}

const parseAndNext = () => {
  parseError.value = ''
  const text = inputMode.value === 'file' && csvFile.value
    ? pasteText.value
    : pasteText.value
  const rows = parseTextToRows(text)
  if (rows.length === 0) {
    parseError.value = t('noValidRows')
    importStep.value = 2
    csvRows.value = []
    return
  }
  csvRows.value = rows
  importStep.value = 2
}

const doImport = async () => {
  importing.value = true
  importResults.value = []
  try {
    const res = await api.post(`/admin/events/${eventId}/teams/import`, { teams: csvRows.value })
    importResults.value = res.data
    importStep.value = 3
    const successCount = res.data.filter(r => r.success).length
    if (successCount > 0) {
      $q.notify({ type: 'positive', message: t('teamsImported', { count: successCount }), position: 'top-right', timeout: 2500 })
      fetchTeams()
    }
  } catch (e) {
    $q.notify({ type: 'negative', message: e.response?.data?.message || t('failedToSaveSettings'), position: 'top-right', timeout: 2500 })
  } finally {
    importing.value = false
  }
}

const resetImport = () => {
  importStep.value = 1
  csvFile.value = null
  pasteText.value = ''
  csvRows.value = []
  parseError.value = ''
  importResults.value = []
}

const onImportHide = () => {
  resetImport()
  importing.value = false
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
