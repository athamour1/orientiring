import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from 'boot/axios'

export const useEventsStore = defineStore('events', () => {
  const events = ref([])
  const loaded = ref(false)

  async function fetchEvents() {
    try {
      const res = await api.get('/admin/events')
      events.value = res.data
      loaded.value = true
    } catch (err) { console.error(err) }
  }

  function addEvent(event) {
    events.value.push(event)
  }

  function removeEvent(id) {
    events.value = events.value.filter(e => e.id !== id)
  }

  return { events, loaded, fetchEvents, addEvent, removeEvent }
})
