/**
 * localComfyConnection.js
 *
 * Legacy compatibility layer that delegates to ComfyUIConnectionManager.
 * All existing imports continue to work — this module re-exports the manager's
 * state in the same shape the rest of the app expects.
 *
 * New code should import getConnectionManager() directly from
 * ComfyUIConnectionManager.js.
 */

import { getConnectionManager, createServerConfig } from './ComfyUIConnectionManager'

export const COMFY_CONNECTION_SETTING_KEY = 'comfyConnection'
export const COMFY_CONNECTION_LOCAL_KEY = 'comfystudio-comfy-connection'
export const COMFY_CONNECTION_CHANGED_EVENT = 'comfystudio-comfy-connection-changed'

export const LOCAL_COMFY_HOST = '127.0.0.1'
export const DEFAULT_COMFY_PORT = 8188
export const DEFAULT_COMFY_MODE = 'local'

const cm = () => getConnectionManager()

function ensureInit() {
  const m = cm()
  if (!m.initialized) {
    m.init()
  }
  return m
}

export function getLocalComfyConnectionSync() {
  const m = ensureInit()
  const config = m.getActiveConfig()
  if (!config) {
    return { mode: 'local', host: '127.0.0.1', port: 8188, httpBase: 'http://127.0.0.1:8188', wsBase: 'ws://127.0.0.1:8188' }
  }
  const httpBase = m.getActiveHttpBase()
  const wsBase = m.getActiveWsBase()
  return {
    mode: config.mode,
    host: config.mode === 'local' ? '127.0.0.1' : new URL(httpBase).hostname,
    port: config.port || 8188,
    httpBase,
    wsBase,
    remoteUrl: config.url || '',
  }
}

function _isTunneled() {
  if (typeof window === 'undefined' || !window.location) return false
  if (window.electronAPI) return false
  const hostname = window.location.hostname
  return hostname !== '127.0.0.1' && hostname !== 'localhost'
}

export function getLocalComfyHttpBaseSync() {
  const m = ensureInit()
  if (_isTunneled()) {
    return m.getActiveProxyHttpBase()
  }
  return m.getActiveHttpBase()
}

export function getLocalComfyWsBaseSync() {
  const m = ensureInit()
  if (_isTunneled()) {
    return m.getActiveProxyWsBase()
  }
  return m.getActiveWsBase()
}

export function getRawComfyHttpBaseSync() {
  const m = ensureInit()
  if (_isTunneled()) {
    return m.getActiveProxyHttpBase()
  }
  return m.getActiveHttpBase()
}

export function getCachedProxyInfo() {
  return null
}

export async function refreshProxyInfo() {
  /* no-op in browser mode */
}

export async function hydrateLocalComfyConnection() {
  const m = ensureInit()
  await m.init()
  return getLocalComfyConnectionSync()
}

export function parseConnectionInput(input) {
  const raw = String(input ?? '').trim()
  if (!raw) {
    return { success: true, config: { mode: 'local', port: 8188, host: '127.0.0.1', httpBase: 'http://127.0.0.1:8188', wsBase: 'ws://127.0.0.1:8188' } }
  }

  if (/^\d+$/.test(raw)) {
    const port = Number(raw)
    if (port < 1 || port > 65535) {
      return { success: false, error: 'Port must be between 1 and 65535.' }
    }
    return {
      success: true,
      config: {
        mode: 'local',
        port,
        host: '127.0.0.1',
        httpBase: `http://127.0.0.1:${port}`,
        wsBase: `ws://127.0.0.1:${port}`,
      },
    }
  }

  let candidate = raw
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) candidate = `https://${candidate}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Use http or https URL (or just a port number).' }
    }
    return {
      success: true,
      config: {
        mode: 'remote',
        host: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        httpBase: parsed.origin,
        wsBase: parsed.origin.replace(/^http/, 'ws'),
        remoteUrl: parsed.origin,
      },
    }
  } catch {
    return { success: false, error: 'Invalid value. Use a port number (e.g. 8188) or a full URL.' }
  }
}

export async function saveComfyConnection(input) {
  const parsed = parseConnectionInput(input)
  if (!parsed.success) return { success: false, error: parsed.error }

  const m = ensureInit()
  const cfg = parsed.config

  if (m.servers.length === 0) {
    m.addServer({
      name: cfg.mode === 'local' ? 'Local ComfyUI' : cfg.remoteUrl || 'Remote ComfyUI',
      mode: cfg.mode,
      port: cfg.port,
      url: cfg.remoteUrl || '',
    })
  } else {
    const active = m.getActiveConfig()
    if (active) {
      m.updateServer(active.id, {
        mode: cfg.mode,
        port: cfg.port,
        url: cfg.remoteUrl || '',
      })
    }
  }

  return { success: true, config: getLocalComfyConnectionSync() }
}

export async function saveLocalComfyConnectionPort(input) {
  return saveComfyConnection(input)
}

export async function checkLocalComfyConnection(options = {}) {
  const m = ensureInit()
  const config = options.config || getLocalComfyConnectionSync()
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000

  const urlsToTry = [config.httpBase]
  // Also try proxy URL when in browser mode
  if (!window.electronAPI && config.mode === 'remote') {
    urlsToTry.push(m.getActiveProxyHttpBase())
  }

  for (const baseUrl of urlsToTry) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = setTimeout(() => { if (controller) controller.abort() }, timeoutMs)
    try {
      const response = await fetch(`${baseUrl}/system_stats`, {
        signal: controller?.signal,
        headers: { Accept: 'application/json' },
        mode: 'cors',
      })
      clearTimeout(timer)
      if (response.ok || response.status > 0) {
        return { ok: true, status: response.status, httpBase: baseUrl, port: config.port, mode: config.mode }
      }
    } catch (err) {
      clearTimeout(timer)
      continue
    }
  }

  const isCors = !window.electronAPI && config.mode === 'remote'
  return {
    ok: false,
    httpBase: config.httpBase,
    port: config.port,
    mode: config.mode,
    error: isCors
      ? `Cannot reach remote server. Ensure ComfyUI has --enable-cors-header * or use a CORS proxy.`
      : `Could not connect to ${config.httpBase}.`,
  }
}

export async function setComfyProxyTarget(targetUrl) {
  try {
    const response = await fetch('/api/__comfy_target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetUrl }),
    })
    return response.ok
  } catch {
    return false
  }
}
