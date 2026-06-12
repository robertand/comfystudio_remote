/**
 * ComfyUIConnectionManager
 *
 * Manages multiple ComfyUI connections (local + remote/Cloudflare Tunnel).
 * Features:
 *   - Connection registry (add/remove/list/activate)
 *   - Per-connection health monitoring via periodic /system_stats pings
 *   - WebSocket keep-alive with heartbeat (ping/pong)
 *   - Authentication support (Basic Auth, Cloudflare Access, custom headers)
 *   - Automatic reconnection with exponential backoff
 *   - Connection state change events
 */

const STORAGE_KEY = 'comfystudio-comfy-servers'
const ACTIVE_KEY = 'comfystudio-comfy-active-server'
export const CONNECTION_CHANGED_EVENT = 'comfystudio-comfy-connection-changed'
const WS_HEARTBEAT_INTERVAL = 15000
const WS_HEARTBEAT_TIMEOUT = 10000
const HEALTH_CHECK_INTERVAL = 15000
const MAX_WS_BACKOFF = 60000
const INITIAL_WS_BACKOFF = 1000

let instance = null

export function getConnectionManager() {
  if (!instance) {
    instance = new ComfyUIConnectionManager()
  }
  return instance
}

// ---- Auth helpers ----

function encodeBasicAuth(user, pass) {
  return 'Basic ' + btoa(`${user}:${pass}`)
}

// ---- Connection model ----

export function createServerConfig(data = {}) {
  return {
    id: data.id || 'server_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: data.name || '',
    url: data.url || '',
    mode: data.mode || 'local',
    port: data.port != null ? Number(data.port) : 8188,
    authType: data.authType || 'none',
    authUser: data.authUser || '',
    authPass: data.authPass || '',
    authToken: data.authToken || '',
    authHeaderName: data.authHeaderName || '',
    authHeaderValue: data.authHeaderValue || '',
    order: data.order || 0,
  }
}

function normalizeUrl(config) {
  if (config.mode === 'local') {
    return { http: `http://127.0.0.1:${config.port}`, ws: `ws://127.0.0.1:${config.port}` }
  }
  let raw = String(config.url || '').trim()
  if (!raw) return { http: `http://127.0.0.1:8188`, ws: `ws://127.0.0.1:8188` }
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const parsed = new URL(raw)
    const http = parsed.origin
    const ws = http.replace(/^http/, 'ws')
    return { http, ws }
  } catch {
    return { http: `http://127.0.0.1:8188`, ws: `ws://127.0.0.1:8188` }
  }
}

function buildAuthHeaders(config) {
  const headers = {}
  if (config.authType === 'basic' && config.authUser && config.authPass) {
    headers['Authorization'] = encodeBasicAuth(config.authUser, config.authPass)
  } else if (config.authType === 'token' && config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`
  } else if (config.authType === 'header' && config.authHeaderName && config.authHeaderValue) {
    headers[config.authHeaderName] = config.authHeaderValue
  } else if (config.authType === 'cloudflare-access' && config.authToken) {
    headers['Cf-Access-Token'] = config.authToken
    headers['CF-Access-Client-Id'] = config.authUser || ''
    headers['CF-Access-Client-Secret'] = config.authPass || ''
  }
  return headers
}

// ---- WebSocket wrapper with auto-reconnect and heartbeat ----

class ManagedWebSocket {
  constructor(manager, serverId) {
    this.manager = manager
    this.serverId = serverId
    this.ws = null
    this.clientId = 'comfystudio-' + Math.random().toString(36).substring(2, 15)
    this.listeners = new Map()
    this.connected = false
    this.intentionalClose = false
    this.backoff = INITIAL_WS_BACKOFF
    this.heartbeatTimer = null
    this.heartbeatTimeoutTimer = null
    this.reconnectTimer = null
    this.failCount = 0
  }

  getHttpBase() {
    const config = this.manager.getConfig(this.serverId)
    if (!config) return 'http://127.0.0.1:8188'
    return normalizeUrl(config).http
  }

  getWsBase() {
    const config = this.manager.getConfig(this.serverId)
    if (!config) return 'ws://127.0.0.1:8188'
    // When accessed through a tunnel or connecting to a remote server,
    // use the proxy WS URL (same-origin) to avoid CORS and mixed-content.
    if (this.manager.isUsingProxy() || config.mode === 'remote') {
      const prefix = this.manager.getProxyPrefix()
      return `${window.location.origin.replace(/^http/, 'ws')}${prefix}`
    }
    return normalizeUrl(config).ws
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return
    this.intentionalClose = false

    const config = this.manager.getConfig(this.serverId)
    if (!config) throw new Error('Server config not found')

    const wsUrl = `${this.getWsBase()}/ws?clientId=${this.clientId}`
    const headers = buildAuthHeaders(config)

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl)
        this.ws.binaryType = 'arraybuffer'
      } catch (err) {
        this.scheduleReconnect()
        reject(err)
        return
      }

      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close()
          this.failCount++
          this.scheduleReconnect()
          reject(new Error('WebSocket connection timeout'))
        }
      }, 10000)

      this.ws.onopen = () => {
        clearTimeout(timeout)
        this.connected = true
        this.failCount = 0
        this.backoff = INITIAL_WS_BACKOFF
        this.startHeartbeat()
        this.manager.emit('ws:connected', { serverId: this.serverId })
        resolve()
      }

      this.ws.onerror = () => {
        clearTimeout(timeout)
        this.failCount++
        this.connected = false
        if (this.failCount < 3) {
          console.warn(`[ComfyUI WS] Connection failed for ${config.name || config.url}, retrying...`)
        }
        this.scheduleReconnect()
        reject(new Error('WebSocket error'))
      }

      this.ws.onmessage = async (event) => {
        try {
          await this.handleData(event.data)
        } catch (e) {
          console.error('[ComfyUI WS] Error handling message:', e)
        }
      }

      this.ws.onclose = () => {
        clearTimeout(timeout)
        this.connected = false
        this.stopHeartbeat()
        this.ws = null
        this.manager.emit('ws:disconnected', { serverId: this.serverId })
        if (!this.intentionalClose) {
          this.scheduleReconnect()
        }
      }
    })
  }

  handleData(rawData) {
    if (typeof rawData === 'string') {
      this.handleMessage(JSON.parse(rawData))
      return
    }
    if (rawData instanceof ArrayBuffer) {
      this.handleBinaryMessage(rawData)
      return
    }
    if (ArrayBuffer.isView(rawData)) {
      this.handleBinaryMessage(rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength))
      return
    }
    if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
      rawData.arrayBuffer().then(buf => this.handleBinaryMessage(buf))
    }
  }

  handleBinaryMessage(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) return
    const view = new DataView(buffer)
    const eventType = view.getUint32(0)
    if (eventType !== 3) return
    this.manager.emit('progress_text', { serverId: this.serverId, data: buffer })
  }

  handleMessage(data) {
    const { type } = data
    if (type === 'progress') {
      this.manager.emit('progress', { serverId: this.serverId, value: data.data.value, max: data.data.max, promptId: data.data.prompt_id })
    } else if (type === 'executing') {
      this.manager.emit('executing', { serverId: this.serverId, node: data.data.node, promptId: data.data.prompt_id })
      if (data.data.node === null) {
        this.manager.emit('complete', { serverId: this.serverId, promptId: data.data.prompt_id })
      }
    } else if (type === 'executed') {
      this.manager.emit('executed', { serverId: this.serverId, node: data.data.node, output: data.data.output, promptId: data.data.prompt_id })
    } else if (type === 'status') {
      this.manager.emit('status', { serverId: this.serverId, status: data.data })
    } else if (type === 'execution_start') {
      this.manager.emit('execution_start', { serverId: this.serverId, promptId: data.data?.prompt_id })
    } else if (type === 'execution_cached') {
      this.manager.emit('execution_cached', { serverId: this.serverId, promptId: data.data?.prompt_id, nodes: data.data?.nodes || [] })
    } else if (type === 'execution_success') {
      this.manager.emit('execution_success', { serverId: this.serverId, promptId: data.data?.prompt_id })
    } else if (type === 'execution_error') {
      this.manager.emit('execution_error', { serverId: this.serverId, promptId: data.data?.prompt_id, nodeId: data.data?.node_id, nodeType: data.data?.node_type, message: data.data?.exception_message || 'Execution error' })
    } else if (type === 'execution_interrupted') {
      this.manager.emit('execution_interrupted', { serverId: this.serverId, promptId: data.data?.prompt_id })
    }
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }))
          this.heartbeatTimeoutTimer = setTimeout(() => {
            console.warn('[ComfyUI WS] Heartbeat timeout, closing connection')
            this.close()
            this.scheduleReconnect()
          }, WS_HEARTBEAT_TIMEOUT)
        } catch (e) {
          /* ignore */
        }
      }
    }, WS_HEARTBEAT_INTERVAL)

    this.ws.addEventListener('message', () => {
      // Any message from the server counts as a sign of life.
      // ComfyUI doesn't respond to our custom ping/pong, so requiring
      // a specific 'pong' type would always time out and close the WS.
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer)
        this.heartbeatTimeoutTimer = null
      }
    })
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
    if (this.heartbeatTimeoutTimer) { clearTimeout(this.heartbeatTimeoutTimer); this.heartbeatTimeoutTimer = null }
  }

  scheduleReconnect() {
    if (this.intentionalClose) return
    if (this.reconnectTimer) return

    const delay = Math.min(this.backoff, MAX_WS_BACKOFF)
    this.backoff = Math.min(this.backoff * 1.5, MAX_WS_BACKOFF)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(() => {})
    }, delay)
  }

  close() {
    this.intentionalClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.connected = false
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event).push(callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const cbs = this.listeners.get(event)
      const idx = cbs.indexOf(callback)
      if (idx >= 0) cbs.splice(idx, 1)
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data))
    }
    this.manager.emit(event, { ...data, serverId: this.serverId })
  }
}

// ---- Main Connection Manager ----

class ComfyUIConnectionManager {
  constructor() {
    this.servers = []
    this.activeServerId = null
    this.wsInstances = new Map()
    this.healthTimers = new Map()
    this.globalListeners = new Map()
    this.initialized = false
  }

  async init() {
    if (this.initialized) return
    this.initialized = true
    this.loadFromStorage()
    // Ensure the Vite proxy target matches the active server
    const active = this.getActiveConfig()
    if (active) {
      await this.updateProxyTarget(active)
    }
    this.startHealthChecks()
    // Emit initial state so UI hooks react
    this.emit('servers:changed', this.getAllServers())
  }

  // ---- Server registry ----

  getAllServers() {
    return [...this.servers]
  }

  getConfig(serverId) {
    return this.servers.find(s => s.id === serverId) || null
  }

  getActiveServerId() {
    return this.activeServerId
  }

  getActiveConfig() {
    if (!this.activeServerId) return null
    return this.getConfig(this.activeServerId)
  }

  getActiveHttpBase() {
    const config = this.getActiveConfig()
    if (!config) return 'http://127.0.0.1:8188'
    return normalizeUrl(config).http
  }

  getActiveWsBase() {
    const config = this.getActiveConfig()
    if (!config) return 'ws://127.0.0.1:8188'
    return normalizeUrl(config).ws
  }

  /** Returns a proxied URL suitable for same-origin requests in the browser.
   *  In dev mode, this routes through Vite's proxy. In production (Electron or
   *  deployed web app), it returns the direct URL (CORS must be configured on
   *  the remote ComfyUI, or a reverse proxy sits in front). */
  getActiveProxyHttpBase() {
    const config = this.getActiveConfig()
    if (!config) return 'http://127.0.0.1:8188'
    const direct = normalizeUrl(config).http
    if (this.isUsingProxy() || config.mode === 'remote') {
      const proxyPrefix = this.getProxyPrefix()
      return `${window.location.origin}${proxyPrefix}`
    }
    return direct
  }

  getActiveProxyWsBase() {
    const config = this.getActiveConfig()
    if (!config) return 'ws://127.0.0.1:8188'
    const direct = normalizeUrl(config).ws
    if (this.isUsingProxy() || config.mode === 'remote') {
      const proxyPrefix = this.getProxyPrefix()
      return `${window.location.origin.replace(/^http/, 'ws')}${proxyPrefix}`
    }
    return direct
  }

  /** Returns true when the app itself is accessed through a tunnel (not localhost).
   *  In that scenario, the embedded ComfyUI iframe and API calls must route
   *  through the app's own origin to avoid mixed-content / CORS issues. */
  isUsingProxy() {
    if (typeof window === 'undefined' || !window.location) return false
    const hostname = window.location.hostname
    return hostname !== '127.0.0.1' && hostname !== 'localhost'
  }

  isTunneled() {
    return this.isUsingProxy()
  }

  getHttpBaseFor(serverId) {
    const config = this.getConfig(serverId)
    if (!config) return 'http://127.0.0.1:8188'
    return normalizeUrl(config).http
  }

  getWsBaseFor(serverId) {
    const config = this.getConfig(serverId)
    if (!config) return 'ws://127.0.0.1:8188'
    return normalizeUrl(config).ws
  }

  getAuthHeadersFor(serverId) {
    const config = this.getConfig(serverId)
    if (!config) return {}
    return buildAuthHeaders(config)
  }

  getActiveAuthHeaders() {
    if (!this.activeServerId) return {}
    return this.getAuthHeadersFor(this.activeServerId)
  }

  async addServer(data) {
    const config = createServerConfig(data)
    config.order = this.servers.length
    this.servers.push(config)
    if (!this.activeServerId) {
      this.activeServerId = config.id
    }
    this.saveToStorage()
    this.emit('servers:changed', this.getAllServers())
    // Update proxy target BEFORE health checks start (Vite proxy must be ready)
    if (this.activeServerId === config.id) {
      await this.updateProxyTarget(config)
    }
    this.startHealthCheckFor(config.id)
    return config
  }

  removeServer(serverId) {
    const idx = this.servers.findIndex(s => s.id === serverId)
    if (idx < 0) return false
    this.servers.splice(idx, 1)
    this.destroyWs(serverId)
    this.stopHealthCheckFor(serverId)
    if (this.activeServerId === serverId) {
      this.activeServerId = this.servers.length > 0 ? this.servers[0].id : null
    }
    this.saveToStorage()
    this.emit('servers:changed', this.getAllServers())
    return true
  }

  updateServer(serverId, data) {
    const config = this.getConfig(serverId)
    if (!config) return false
    Object.assign(config, data)
    this.destroyWs(serverId)
    this.saveToStorage()
    this.emit('servers:changed', this.getAllServers())
    return true
  }

  async setActiveServer(serverId) {
    const config = this.getConfig(serverId)
    if (!config) return false
    const prevId = this.activeServerId
    // Destroy old WS before switching
    if (prevId && prevId !== serverId) {
      this.destroyWs(prevId)
    }
    this.activeServerId = serverId
    this.saveToStorage()
    this.emit('active:changed', { serverId, previousId: prevId })
    this.emit('servers:changed', this.getAllServers())
    // Update the Vite dev proxy target so /system_stats, /prompt, etc. are proxied
    // to this server's URL
    await this.updateProxyTarget(config)
    return true
  }

  async updateProxyTarget(config) {
    if (typeof window === 'undefined') return
    const targetUrl = config.mode === 'local'
      ? `http://127.0.0.1:${config.port}`
      : normalizeUrl(config).http
    try {
      await fetch('/api/__comfy_target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetUrl }),
      })
    } catch (e) {
      // Not running behind Vite dev server — that's fine
    }
  }

  // ---- Health checks ----

  startHealthChecks() {
    for (const server of this.servers) {
      this.startHealthCheckFor(server.id)
    }
  }

  startHealthCheckFor(serverId) {
    this.stopHealthCheckFor(serverId)
    const timer = setInterval(() => {
      this.checkServerHealth(serverId)
    }, HEALTH_CHECK_INTERVAL)
    this.healthTimers.set(serverId, timer)
    this.checkServerHealth(serverId)
  }

  stopHealthCheckFor(serverId) {
    if (this.healthTimers.has(serverId)) {
      clearInterval(this.healthTimers.get(serverId))
      this.healthTimers.delete(serverId)
    }
  }

  async checkServerHealth(serverId) {
    const config = this.getConfig(serverId)
    if (!config) return { ok: false }

    const headers = buildAuthHeaders(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    // Strategy: try multiple URL patterns
    const urlsToTry = []
    const directUrl = normalizeUrl(config).http
    const usingProxy = this.isUsingProxy() && typeof window !== 'undefined'

    if (usingProxy) {
      // Behind Vite proxy — only the proxy URL works (direct URL is CORS-blocked)
      const prefix = this.getProxyPrefix()
      urlsToTry.push(`${window.location.origin}${prefix}`)
    } else if (config.mode === 'remote') {
      // Remote server accessed from localhost — must proxy to avoid CORS
      const prefix = this.getProxyPrefix()
      urlsToTry.push(`${window.location.origin}${prefix}`)
    } else {
      // Direct URL (localhost or same-origin)
      urlsToTry.push(directUrl)
    }

    for (const baseUrl of urlsToTry) {
      try {
        const response = await fetch(`${baseUrl}/system_stats`, {
          signal: controller.signal,
          headers: { ...headers, 'Accept': 'application/json' },
          mode: 'cors',
        })
        if (response.ok) {
          clearTimeout(timeout)
          this.emit('health:result', { serverId, ok: true, status: response.status })
          return { ok: true, status: response.status }
        }
        // Server responded but with error status — still means it's reachable
        if (response.status !== 0) {
          clearTimeout(timeout)
          this.emit('health:result', { serverId, ok: true, status: response.status })
          return { ok: true, status: response.status }
        }
      } catch (err) {
        // CORS errors show as TypeError: Failed to fetch — try next URL
        continue
      }
    }

    clearTimeout(timeout)
    const isTunnel = typeof window !== 'undefined' && this.isUsingProxy()
    let errorMsg
    if (isTunnel) {
      errorMsg = `${config.name} is unreachable. The proxy at ${window.location.origin}/comfy/ cannot reach ${directUrl}. Ensure ComfyUI is running and the tunnel has access.`
    } else {
      errorMsg = `Could not connect to ${directUrl}`
    }
    this.emit('health:result', { serverId, ok: false, error: errorMsg })
    return { ok: false, error: errorMsg }
  }

  // ---- WebSocket management ----

  getOrCreateWs(serverId) {
    if (!this.wsInstances.has(serverId)) {
      const mws = new ManagedWebSocket(this, serverId)
      this.wsInstances.set(serverId, mws)
    }
    return this.wsInstances.get(serverId)
  }

  getActiveWs() {
    if (!this.activeServerId) return null
    return this.getOrCreateWs(this.activeServerId)
  }

  async connectWs(serverId) {
    const mws = this.getOrCreateWs(serverId)
    await mws.connect()
    return mws
  }

  async connectActiveWs() {
    if (!this.activeServerId) throw new Error('No active server')
    return this.connectWs(this.activeServerId)
  }

  disconnectWs(serverId) {
    if (this.wsInstances.has(serverId)) {
      this.wsInstances.get(serverId).close()
    }
  }

  destroyWs(serverId) {
    this.disconnectWs(serverId)
    this.wsInstances.delete(serverId)
  }

  isWsConnected(serverId) {
    const mws = this.wsInstances.get(serverId)
    return mws ? mws.isConnected() : false
  }

  isActiveWsConnected() {
    return this.activeServerId ? this.isWsConnected(this.activeServerId) : false
  }

  // ---- Event system (global) ----

  on(event, callback) {
    if (!this.globalListeners.has(event)) this.globalListeners.set(event, [])
    this.globalListeners.get(event).push(callback)
  }

  off(event, callback) {
    if (this.globalListeners.has(event)) {
      const cbs = this.globalListeners.get(event)
      const idx = cbs.indexOf(callback)
      if (idx >= 0) cbs.splice(idx, 1)
    }
  }

  emit(event, data) {
    if (this.globalListeners.has(event)) {
      this.globalListeners.get(event).forEach(cb => {
        try { cb(data) } catch (e) { console.error('[CM] listener error:', e) }
      })
    }
    // Dispatch legacy window event when connection changes so App.jsx iframe updates
    if (event === 'active:changed' || event === 'servers:changed') {
      try {
        const config = this.getActiveConfig()
        if (config && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('comfystudio-comfy-connection-changed', {
            detail: {
              httpBase: this.isUsingProxy() || config.mode === 'remote' ? this.getActiveProxyHttpBase() : this.getActiveHttpBase(),
              serverId: this.activeServerId,
              mode: config.mode,
            },
          }))
        }
      } catch (e) { /* ignore */ }
    }
  }

  // ---- Persistence ----

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          this.servers = parsed.map(createServerConfig)
        }
      }
      const activeRaw = localStorage.getItem(ACTIVE_KEY)
      if (activeRaw) {
        this.activeServerId = activeRaw
      }

      if (this.servers.length === 0) {
        this.addDefaultServer()
      }

      if (!this.activeServerId && this.servers.length > 0) {
        this.activeServerId = this.servers[0].id
      }
    } catch (e) {
      console.warn('[CM] Failed to load from storage:', e)
      if (this.servers.length === 0) {
        this.addDefaultServer()
      }
    }
  }

  addDefaultServer() {
    this.servers.push(createServerConfig({
      id: 'server_local',
      name: 'Local ComfyUI',
      mode: 'local',
      port: 8188,
    }))
    this.activeServerId = 'server_local'
  }

  saveToStorage() {
    try {
      const data = this.servers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        mode: s.mode,
        port: s.port,
        authType: s.authType,
        authUser: s.authUser,
        authPass: s.authPass,
        authToken: s.authToken,
        authHeaderName: s.authHeaderName,
        authHeaderValue: s.authHeaderValue,
        order: s.order,
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      if (this.activeServerId) {
        localStorage.setItem(ACTIVE_KEY, this.activeServerId)
      }
    } catch (e) {
      console.warn('[CM] Failed to save:', e)
    }
  }

  // ---- HTTP helpers (auth-wrapped fetch) ----

  async fetch(serverId, path, options = {}) {
    const config = this.getConfig(serverId || this.activeServerId)
    if (!config) throw new Error('No server config')
    const base = normalizeUrl(config).http
    const authHeaders = buildAuthHeaders(config)
    const headers = { ...authHeaders, ...options.headers }
    const url = `${base}${path}`
    const resp = await fetch(url, { ...options, headers })
    return resp
  }

  async activeFetch(path, options = {}) {
    if (!this.activeServerId) throw new Error('No active server')
    return this.fetch(this.activeServerId, path, options)
  }

  // ---- Utility ----

  getProxyPrefix() {
    return '/comfy'
  }

  generateClientId() {
    return 'comfystudio-' + Math.random().toString(36).substring(2, 15)
  }
}

export { ComfyUIConnectionManager }
export default ComfyUIConnectionManager
