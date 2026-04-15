import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTeamEventStore = defineStore('teamEvent', () => {
  const allDone = ref(false)
  const startTime = ref(null) // ISO string or null
  const endTime = ref(null)   // ISO string or null
  const eventStatus = ref(null) // 'pending' | 'active' | 'ended' | null
  const eventId = ref(null)
  const eventName = ref(null)
  const eventDescription = ref(null)
  return { allDone, startTime, endTime, eventStatus, eventId, eventName, eventDescription }
})
