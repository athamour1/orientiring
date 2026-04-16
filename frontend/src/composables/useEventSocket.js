import { onUnmounted } from 'vue'
import { socket, isConnected, connectSocket } from 'src/boot/socket'

/**
 * Join a specific event room on the shared WebSocket connection.
 * Returns { socket, isConnected } so callers can listen to events.
 * Automatically leaves the room when the component unmounts.
 *
 * Usage:
 *   const { socket, isConnected } = useEventSocket(eventId)
 *   socket.on('scan:created', handler)
 */
export function useEventSocket(eventId) {
  const eid = Number(eventId)

  // Ensure connected
  connectSocket()

  // Join now if already connected, and re-join on every reconnect
  if (socket.connected) {
    socket.emit('join', eid)
  }
  const onConnect = () => socket.emit('join', eid)
  socket.on('connect', onConnect)

  onUnmounted(() => {
    socket.emit('leave', eid)
    socket.off('connect', onConnect)
  })

  return { socket, isConnected }
}
