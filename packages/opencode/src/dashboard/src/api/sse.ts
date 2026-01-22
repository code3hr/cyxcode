/**
 * SSE Client for Real-time Updates
 *
 * Subscribes to server-sent events for live dashboard updates.
 */

export type PentestEventType =
  | "pentest.finding_created"
  | "pentest.finding_updated"
  | "pentest.scan_started"
  | "pentest.scan_completed"
  | "pentest.monitor.run_started"
  | "pentest.monitor.run_completed"
  | "pentest.monitor.run_failed"
  | "pentest.monitor.alert.new_vulnerabilities"
  | "server.connected"
  | "server.heartbeat"

export interface SSEEvent {
  type: PentestEventType
  properties: Record<string, unknown>
}

type EventCallback = (event: SSEEvent) => void

class SSEClient {
  private eventSource: EventSource | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private connectCallbacks: Set<() => void> = new Set()
  private disconnectCallbacks: Set<() => void> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect() {
    if (this.eventSource) {
      return
    }

    try {
      this.eventSource = new EventSource("/global/event")

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0
        this.connectCallbacks.forEach((cb) => cb())
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const payload = data.payload as SSEEvent

          if (payload?.type) {
            this.emit(payload.type, payload)
            this.emit("*", payload) // Wildcard listeners
          }
        } catch {
          console.error("Failed to parse SSE event:", event.data)
        }
      }

      this.eventSource.onerror = () => {
        this.handleDisconnect()
      }
    } catch (err) {
      console.error("Failed to create EventSource:", err)
      this.handleDisconnect()
    }
  }

  private handleDisconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.disconnectCallbacks.forEach((cb) => cb())

    // Attempt reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      setTimeout(() => this.connect(), delay)
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.listeners.clear()
  }

  on(eventType: PentestEventType | "*", callback: EventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback)
    }
  }

  off(eventType: PentestEventType | "*", callback: EventCallback) {
    this.listeners.get(eventType)?.delete(callback)
  }

  private emit(eventType: string, event: SSEEvent) {
    this.listeners.get(eventType)?.forEach((cb) => cb(event))
  }

  onConnect(callback: () => void) {
    this.connectCallbacks.add(callback)
    return () => this.connectCallbacks.delete(callback)
  }

  onDisconnect(callback: () => void) {
    this.disconnectCallbacks.add(callback)
    return () => this.disconnectCallbacks.delete(callback)
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN
  }
}

// Singleton instance
export const sseClient = new SSEClient()
