import http from 'http'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { WebSocket as NodeWebSocket, WebSocketServer } from 'ws'
import { spawn } from 'child_process'
import crypto from 'crypto'
import zlib from 'zlib'
import os from 'os'

const PORT = Number(process.env.PORT) || 5173
const DIST_DIR = path.resolve(import.meta.dirname, 'dist')
const DEFAULT_COMFY_TARGET = process.env.VITE_COMFY_URL || 'http://127.0.0.1:8188'
const STORAGE_PATH = path.resolve(import.meta.dirname, 'node_modules', '.vite-comfy-target')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

function getComfyTarget() {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = fs.readFileSync(STORAGE_PATH, 'utf-8').trim()
      if (data) return data
    }
  } catch {}
  return DEFAULT_COMFY_TARGET
}

function setComfyTarget(url) {
  try {
    fs.writeFileSync(STORAGE_PATH, url, 'utf-8')
  } catch {}
}

function getAuthHeadersForTarget(targetUrl) {
  try {
    const serversRaw = process.env.VITE_COMFY_SERVERS
    if (!serversRaw) return {}
    const servers = JSON.parse(serversRaw)
    const target = servers.find(s => {
      if (s.mode === 'local') return false
      return s.url && targetUrl.includes(new URL(s.url).hostname)
    })
    if (!target) return {}
    const headers = {}
    if (target.authType === 'basic' && target.authUser && target.authPass) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${target.authUser}:${target.authPass}`).toString('base64')
    } else if (target.authType === 'token' && target.authToken) {
      headers['Authorization'] = `Bearer ${target.authToken}`
    } else if (target.authType === 'header' && target.authHeaderName && target.authHeaderValue) {
      headers[target.authHeaderName] = target.authHeaderValue
    } else if (target.authType === 'cloudflare-access' && target.authToken) {
      headers['Cf-Access-Token'] = target.authToken
      headers['CF-Access-Client-Id'] = target.authUser || ''
      headers['CF-Access-Client-Secret'] = target.authPass || ''
    }
    return headers
  } catch {
    return {}
  }
}

function rewriteHtml(body, prefix) {
  let html = body
  html = html.replace(/<base[^>]*>/gi, '')
  html = html.replace(/(\s(src|href|action)\s*=\s*)"\/(?!\/)/gi, `$1"${prefix}/`)
  html = html.replace(/(\s(src|href|action)\s*=\s*)'\/(?!\/)/gi, `$1'${prefix}/`)
  html = html.replace(/(url\(\s*)"\/(?!\/)/gi, `$1"${prefix}/`)
  html = html.replace(/(url\(\s*)'\/(?!\/)/gi, `$1'${prefix}/`)
  html = html.replace(/(@import\s+)"\/(?!\/)/gi, `$1"${prefix}/`)
  html = html.replace(/(@import\s+)'\/(?!\/)/gi, `$1'${prefix}/`)
  html = html.replace('</head>', `<base href="${prefix}/">
<script>
(function(){const p='${prefix}';const ap=['/ws','/system_stats','/prompt','/history','/queue','/interrupt','/view','/upload','/workflow_templates','/extensions','/object_info','/api/','/manager/','/static/','/media/','/assets/'];
const of=window.fetch;window.fetch=function(u,o){if(typeof u==='string'){for(let i=0;i<ap.length;i++){if(u.startsWith(ap[i])&&!u.startsWith(p)){u=p+u;break}}}
return of.call(this,u,o)};
const ox=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,a,us,pw){let nu=u;if(typeof u==='string'){for(let i=0;i<ap.length;i++){if(u.startsWith(ap[i])&&!u.startsWith(p)){nu=p+u;break}}}
return ox.call(this,m,nu,a,us,pw)};
const ow=window.WebSocket;window.WebSocket=function(u,p){let nu=u;if(typeof u==='string'){for(let i=0;i<ap.length;i++){if(u.startsWith(ap[i])&&!u.startsWith(p)){nu=p+u;break}}}
return new ow(nu,p)};
})();
</script>
</head>`)
  return html
}

function nodeRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http
    const options = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
      rejectUnauthorized: false,
    }
    const req = mod.request(options, (res) => resolve(res))
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function collectResBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = []
    res.on('data', (c) => chunks.push(c))
    res.on('end', () => {
      let buf = Buffer.concat(chunks)
      const encoding = (res.headers['content-encoding'] || '').toLowerCase()
      if (encoding === 'gzip') {
        buf = zlib.gunzipSync(buf)
      } else if (encoding === 'deflate') {
        buf = zlib.inflateSync(buf)
      } else if (encoding === 'br') {
        buf = zlib.brotliDecompressSync(buf)
      }
      resolve(buf)
    })
    res.on('error', reject)
  })
}

function pipeRes(sourceRes, targetRes) {
  targetRes.writeHead(sourceRes.statusCode, sourceRes.headers)
  sourceRes.pipe(targetRes)
}

async function proxyToTarget(req, res) {
  const targetUrl = getComfyTarget().replace(/\/+$/, '')
  const targetOrigin = new URL(targetUrl).origin
  const [pathPart, ...qsParts] = req.url.split('?')
  const pathname = pathPart || '/'
  const query = qsParts.length > 0 ? '?' + qsParts.join('?') : ''
  const fetchUrl = `${targetUrl}${pathname}${query}`
  console.log(`[proxy] ${req.method} ${req.url} -> ${fetchUrl}`)
  const authHeaders = getAuthHeadersForTarget(targetUrl)

  // Collect body for POST/PUT/PATCH
  let body = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await bodyBuffer(req)
  }

  try {
    const proxyHeaders = { ...req.headers, ...authHeaders }
    delete proxyHeaders.host
    delete proxyHeaders.connection
    delete proxyHeaders['keep-alive']
    delete proxyHeaders.origin
    delete proxyHeaders.referer
    proxyHeaders['Host'] = new URL(targetUrl).host
    proxyHeaders['Origin'] = targetOrigin
    proxyHeaders['Referer'] = targetOrigin + '/'

    const response = await nodeRequest({
      method: req.method,
      url: fetchUrl,
      headers: proxyHeaders,
      body,
    })

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers['location']
      if (location) {
        const rewritten = location.startsWith('/')
          ? `/comfy${location}`
          : location.replace(targetUrl, '/comfy')
        const outHeaders = { ...response.headers, location: rewritten }
        for (const k of ['content-length', 'content-encoding', 'transfer-encoding']) delete outHeaders[k]
        res.writeHead(response.statusCode, outHeaders)
        res.end()
        return
      }
    }
    const contentType = response.headers['content-type'] || ''
    const isPageRequest = req.url === '/' || req.url === ''
    if (contentType.includes('text/html') && isPageRequest) {
      const bodyBuffer = await collectResBody(response)
      const body = bodyBuffer.toString('utf8')
      const rewritten = rewriteHtml(body, '/comfy')
      const outHeaders = { ...response.headers, 'content-length': Buffer.byteLength(rewritten) }
      delete outHeaders['content-encoding']
      delete outHeaders['transfer-encoding']
      res.writeHead(response.statusCode, outHeaders)
      res.end(rewritten)
    } else {
      pipeRes(response, res)
    }
  } catch (err) {
    console.error(`[proxy] error fetching ${fetchUrl}:`, err.message)
    res.statusCode = 502
    res.end(`Proxy error: ${err.message}`)
  }
}

async function serveStatic(req, res, next) {
  let urlPath = req.url.split('?')[0]
  if (urlPath.endsWith('/') && urlPath !== '/') {
    urlPath = urlPath.slice(0, -1)
  }
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath)

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }

  try {
    const stat = await fs.promises.stat(filePath)
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      await fs.promises.stat(filePath)
    }
    const ext = path.extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res)
    return true
  } catch {
    next()
    return false
  }
}

async function requestHandler(req, res) {
  const url = req.url || '/'
  const method = req.method

  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  // --- Runtime target setter ---
  if (url.startsWith('/api/__comfy_target') && method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const { target } = JSON.parse(body)
        if (target && typeof target === 'string') {
          setComfyTarget(target)
          console.log(`[server] target set to ${target}`)
          res.end(JSON.stringify({ ok: true, target }))
        } else {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: 'Invalid target' }))
        }
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // --- ComfyUI proxy paths ---
  if (url.startsWith('/comfy')) {
    const originalUrl = req.url
    req.url = url.replace(/^\/comfy/, '') || '/'
    await proxyToTarget(req, res)
    req.url = originalUrl
    return
  }

  // --- Export API ---
  if (url.startsWith('/api/export')) {
    const u = new URL(url, 'http://localhost')
    const p = u.pathname.replace(/\/$/, '')

    if (p === '/api/export/ping' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, node: process.version }))
      return
    }
    if (p === '/api/export/create-session' && method === 'POST') {
      const id = crypto.randomUUID()
      const dir = path.join(os.tmpdir(), 'comfy-export-sessions', id)
      fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
      exportSessions.set(id, { dir, createdAt: Date.now() })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ sessionId: id }))
      return
    }

    const mUploadFrame = p.match(/^\/api\/export\/upload-frame\/([^/]+)\/(\d+)$/)
    if (mUploadFrame && method === 'POST') {
      const [, sid, idx] = mUploadFrame
      const s = exportSessions.get(sid)
      if (!s) { res.writeHead(404); res.end('Session not found'); return }
      const buf = await bodyBuffer(req)
      let frameExt = 'png'
      if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) frameExt = 'jpg'
      else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E) frameExt = 'png'
      else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46) frameExt = 'webp'
      const name = `frame_${String(parseInt(idx) + 1).padStart(6, '0')}.${frameExt}`
      s.frameExt = frameExt
      fs.writeFileSync(path.join(s.dir, 'frames', name), buf)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ext: frameExt }))
      return
    }

    const mUploadAudio = p.match(/^\/api\/export\/upload-audio\/([^/]+)$/)
    if (mUploadAudio && method === 'POST') {
      const [, sid] = mUploadAudio
      const s = exportSessions.get(sid)
      if (!s) { res.writeHead(404); res.end('Session not found'); return }
      const buf = await bodyBuffer(req)
      const audioPath = path.join(s.dir, 'audio.wav')
      fs.writeFileSync(audioPath, buf)
      s.audioPath = audioPath
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (p === '/api/export/encode' && method === 'POST') {
      const raw = await bodyBuffer(req)
      const params = JSON.parse(raw.toString())
      const s = exportSessions.get(params.sessionId)
      if (!s) { res.writeHead(404); res.end('Session not found'); return }

      const ext = params.format || 'mp4'
      const outputPath = path.join(s.dir, `output.${ext}`)
      const frameDir = path.join(s.dir, 'frames')
      const frameExt = s.frameExt || 'png'
      const framePattern = path.join(frameDir, `frame_%06d.${frameExt}`)

      if (ext === 'gif') {
        const fps = String(params.fps || 10)
        const scale = params.width ? `${params.width}:-1:flags=lanczos` : '320:-1:flags=lanczos'
        const palettePath = path.join(s.dir, 'palette.png')
        try {
          const p1 = spawn('ffmpeg', ['-framerate', fps, '-i', framePattern, '-vf', `fps=${fps},scale=${scale},palettegen=stats_mode=diff`, '-y', palettePath])
          await new Promise((resolve, reject) => {
            let e = ''
            p1.stderr.on('data', d => { e += d.toString() })
            p1.on('close', c => c === 0 ? resolve() : reject(new Error(e.slice(-500))))
            p1.on('error', reject)
          })
          const p2 = spawn('ffmpeg', ['-framerate', fps, '-i', framePattern, '-i', palettePath, '-lavfi', `fps=${fps},scale=${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`, '-y', outputPath])
          await new Promise((resolve, reject) => {
            let e = ''
            p2.stderr.on('data', d => { e += d.toString() })
            p2.on('close', c => c === 0 ? resolve() : reject(new Error(e.slice(-500))))
            p2.on('error', reject)
          })
          const stat = fs.statSync(outputPath)
          res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': stat.size, 'Content-Disposition': 'attachment; filename="export.gif"' })
          fs.createReadStream(outputPath).pipe(res)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `gif encode failed: ${err.message}` }))
        }
        return
      }

      if (ext === 'zip') {
        try {
          const zipPath = path.join(s.dir, 'frames.zip')
          const frameFiles = fs.readdirSync(frameDir).map(f => path.join(frameDir, f))
          const zip = spawn('zip', ['-j', zipPath, '-@'])
          zip.stdin.end(frameFiles.join('\n'))
          await new Promise((resolve, reject) => {
            let e = ''
            zip.stderr.on('data', d => { e += d.toString() })
            zip.on('close', c => c === 0 ? resolve() : reject(new Error(e.slice(-500))))
            zip.on('error', reject)
          })
          const stat = fs.statSync(zipPath)
          res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': stat.size, 'Content-Disposition': 'attachment; filename="frames.zip"' })
          fs.createReadStream(zipPath).pipe(res)
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `zip failed: ${err.message}` }))
        }
        return
      }

      const args = ['-framerate', String(params.fps), '-i', framePattern]
      if (s.audioPath && params.includeAudio !== false) args.push('-i', s.audioPath)
      const vcodec = params.videoCodec === 'h265' ? 'libx265' : params.videoCodec === 'prores' ? 'prores_ks' : 'libx264'
      args.push('-c:v', vcodec)
      if (s.audioPath && params.includeAudio !== false) args.push('-c:a', params.audioCodec === 'opus' ? 'libopus' : params.audioCodec || 'aac')
      if (params.preset && params.videoCodec !== 'prores') args.push('-preset', params.preset)
      if (params.crf != null && params.videoCodec !== 'prores') args.push('-crf', String(params.crf))
      if (params.bitrateKbps && params.videoCodec !== 'prores') args.push('-b:v', `${params.bitrateKbps}k`)
      if (params.proresProfile && params.videoCodec === 'prores') args.push('-profile:v', params.proresProfile)
      args.push('-y', outputPath)

      const ff = spawn('ffmpeg', args)
      let stderr = ''
      ff.stderr.on('data', d => { stderr += d.toString() })
      try {
        await new Promise((resolve, reject) => {
          ff.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-500))))
          ff.on('error', reject)
        })
        const stat = fs.statSync(outputPath)
        res.writeHead(200, { 'Content-Type': `video/${ext}`, 'Content-Length': stat.size, 'Content-Disposition': `attachment; filename="export.${ext}"` })
        fs.createReadStream(outputPath).pipe(res)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `ffmpeg failed: ${err.message}` }))
      }
      return
    }

    const mCleanup = p.match(/^\/api\/export\/cleanup\/([^/]+)$/)
    if (mCleanup && method === 'POST') {
      const [, sid] = mCleanup
      const s = exportSessions.get(sid)
      if (s) { fs.rmSync(s.dir, { recursive: true, force: true }); exportSessions.delete(sid) }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    res.statusCode = 404
    res.end('Not Found')
    return
  }

  // --- Try static files first ---
  // For /assets/ paths, try local files first, then fall back to ComfyUI proxy
  if (url.startsWith('/assets/') && method === 'GET') {
    const served = await new Promise(resolve => {
      serveStatic(req, res, () => resolve(false))
    })
    if (served !== false) return
    // Fallback: proxy to ComfyUI for dynamically-loaded chunks
    const subPath = url.replace(/^\/assets/, '')
    req.url = '/assets' + subPath
    await proxyToTarget(req, res)
    return
  }

  // --- ComfyUI API paths (proxied) ---
  const comfyApiPaths = [
    '/system_stats', '/prompt', '/history', '/queue', '/interrupt',
    '/view', '/upload', '/workflow_templates', '/extensions', '/object_info',
    '/api/', '/manager/', '/static/', '/media/',
    '/scripts/', '/fonts/', '/rgthree/', '/user/',
  ]
  for (const apiPath of comfyApiPaths) {
    if (url.startsWith(apiPath) && ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(method)) {
      const mountDir = apiPath.endsWith('/') ? apiPath.slice(0, -1) : apiPath
      const subPath = url === mountDir ? '' : url.slice(mountDir.length)
      req.url = mountDir + subPath
      await proxyToTarget(req, res)
      req.url = url
      return
    }
  }

  // --- WebSocket path (rest handled by server.upgrade) ---
  if (url === '/ws' && method === 'GET') {
    res.statusCode = 400
    res.end('WebSocket upgrade required')
    return
  }

  // --- Static files (catch-all) ---
  const served = await serveStatic(req, res, () => {})
  if (!served) {
    // Fallback: serve index.html for SPA routing
    const indexPath = path.join(DIST_DIR, 'index.html')
    try {
      const stat = fs.statSync(indexPath)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': stat.size })
      fs.createReadStream(indexPath).pipe(res)
    } catch {
      res.statusCode = 404
      res.end('Not Found')
    }
  }
}

// Export sessions
const EXPORT_BASE = path.join(os.tmpdir(), 'comfy-export-sessions')
const exportSessions = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [id, s] of exportSessions) {
    if (now - s.createdAt > 3600000) {
      fs.rmSync(s.dir, { recursive: true, force: true })
      exportSessions.delete(id)
    }
  }
}, 60000)

const bodyBuffer = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

const server = http.createServer(requestHandler)

// WebSocket proxy for /comfy/ws
const wssBridge = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = req.url || ''
  if (!url.startsWith('/comfy')) return

  const targetUrl = getComfyTarget().replace(/\/+$/, '')
  const wsTarget = targetUrl.replace(/^http/, 'ws')
  const path = url.replace(/^\/comfy/, '') || '/'
  const wsUrl = `${wsTarget}${path}`

  wssBridge.handleUpgrade(req, socket, head, (browserWs) => {
    const targetWs = new NodeWebSocket(wsUrl, {
      rejectUnauthorized: false,
      handshakeTimeout: 15000,
      maxPayload: 256 * 1024 * 1024,
    })

    const closeBoth = () => {
      try { browserWs.close() } catch {}
      try { targetWs.close() } catch {}
    }

    const heartbeat = setInterval(() => {
      if (browserWs.readyState === NodeWebSocket.OPEN) {
        try { browserWs.ping() } catch {}
      }
      if (targetWs.readyState === NodeWebSocket.OPEN) {
        try { targetWs.ping() } catch {}
      }
    }, 15000)

    targetWs.on('open', () => {
      browserWs.on('message', (data) => {
        if (targetWs.readyState === NodeWebSocket.OPEN) targetWs.send(data)
      })
      browserWs.on('close', () => { clearInterval(heartbeat); closeBoth() })
      browserWs.on('error', () => { clearInterval(heartbeat); closeBoth() })

      targetWs.on('message', (data) => {
        if (browserWs.readyState === NodeWebSocket.OPEN) browserWs.send(data)
      })
      targetWs.on('close', () => { clearInterval(heartbeat); closeBoth() })
      targetWs.on('error', () => { clearInterval(heartbeat); closeBoth() })
    })

    targetWs.on('error', () => {
      clearInterval(heartbeat)
      try { browserWs.close() } catch {}
    })
  })
})

server.listen(PORT, () => {
  console.log(`[server] ComfyStudio production server running on http://localhost:${PORT}`)
  console.log(`[server] Serving static files from ${DIST_DIR}`)
  console.log(`[server] Proxying ComfyUI requests to ${getComfyTarget()}`)
})
