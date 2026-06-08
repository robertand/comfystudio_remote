export const isElectron = () => typeof window !== 'undefined' && window.electronAPI != null

const EXPORT_API = '/api/export'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function createExportPlatform(projectHandle) {
  if (isElectron()) {
    return createElectronPlatform(projectHandle)
  }
  return createWebPlatform(projectHandle)
}

// ── Electron platform (local, unchanged) ──────────────────────────

function createElectronPlatform(projectHandle) {
  const api = window.electronAPI
  return {
    type: 'electron',
    projectHandle,
    isElectron: true,

    async createExportDirs() {
      const outputFolder = await api.pathJoin(projectHandle, 'renders')
      await api.createDirectory(outputFolder)
      const tempFolder = await api.pathJoin(outputFolder, `export_${Date.now()}`)
      await api.createDirectory(tempFolder)
      const framesFolder = await api.pathJoin(tempFolder, 'frames')
      await api.createDirectory(framesFolder)
      return { outputFolder, tempFolder, framesFolder }
    },

    async resolveOutputPath(defaultPath, ext) {
      const result = await api.saveFileDialog({
        title: 'Export Timeline',
        defaultPath,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      })
      return result || null
    },

    canUseDirectFramePipe: true,

    async startFramePipe(opts) {
      if (!api.startFramePipe) return null
      const result = await api.startFramePipe(opts)
      return result?.success && result.sessionId ? result : null
    },

    async writeFrameToPipe(sessionId, buffer) {
      const result = await api.writeFrameToPipe(sessionId, buffer)
      return result?.success
    },

    async finishFramePipe(sessionId) {
      return await api.finishFramePipe(sessionId)
    },

    async abortFramePipe(sessionId) {
      try { await api.abortFramePipe(sessionId) } catch {}
    },

    async writeFrame(canvas, _dirHandle, index) {
      const buffer = await new Promise(resolve =>
        canvas.toBlob(b => b.arrayBuffer().then(resolve), 'image/png')
      )
      const framePath = await api.pathJoin(_dirHandle, `frame_${String(index + 1).padStart(6, '0')}.png`)
      await api.writeFileFromArrayBuffer(framePath, buffer)
    },

    async writeFrameAsPng(dirHandle, index, buffer) {
      const framePath = await api.pathJoin(dirHandle, `frame_${String(index + 1).padStart(6, '0')}.png`)
      await api.writeFileFromArrayBuffer(framePath, buffer)
    },

    async flushFrames() {},

    getFramePattern(framesFolder) {
      return api.pathJoin(framesFolder, 'frame_%06d.png')
    },

    getAudioPath(tempFolder) {
      return api.pathJoin(tempFolder, 'audio.wav')
    },

    getPipedVideoPath(tempFolder, ext) {
      return api.pathJoin(tempFolder, `video_only.${ext}`)
    },

    async mixAudio(opts) {
      if (!api.mixAudio) return null
      return await api.mixAudio(opts)
    },

    async writeAudioWav(tempFolder, wavData) {
      const audioPath = await api.pathJoin(tempFolder, 'audio.wav')
      await api.writeFileFromArrayBuffer(audioPath, wavData)
      return audioPath
    },

    async encodeVideo(opts) {
      return await api.encodeVideo(opts)
    },

    async muxAudioVideo(opts) {
      return await api.muxAudioVideo(opts)
    },

    async copyFile(src, dest) {
      return await api.copyFile(src, dest)
    },

    async cleanup(tempFolder) {
      await api.deleteDirectory(tempFolder, { recursive: true })
    },

    async resolveAssetUrl(asset) {
      if (!asset?.url) return null
      if (projectHandle && asset.path) {
        try {
          const filePath = await api.pathJoin(projectHandle, asset.path)
          return await api.getFileUrlDirect(filePath)
        } catch (e) {
          console.warn('Export: could not resolve file URL for asset, using blob:', asset.name, e)
        }
      }
      return asset.url
    },

    async resolveProxyUrl(asset) {
      if (!asset || asset.type !== 'video') return null
      if (asset.proxyStatus !== 'ready' || !asset.proxyPath) return null
      if (projectHandle && asset.proxyPath) {
        try {
          const filePath = await api.pathJoin(projectHandle, asset.proxyPath)
          return await api.getFileUrlDirect(filePath)
        } catch (e) {
          console.warn('Export: could not resolve proxy URL, using original:', asset.name, e)
        }
      }
      return asset.proxyUrl || null
    },

    async resolveCacheUrl(clip) {
      if (clip.cacheUrl) return clip.cacheUrl
      if (clip.cachePath && projectHandle) {
        try {
          const filePath = await api.pathJoin(projectHandle, clip.cachePath)
          return await api.getFileUrlDirect(filePath)
        } catch (err) {
          console.warn('Failed to load cached render for export:', err)
        }
      }
      return null
    },
  }
}

// ── Web platform (remote, server-side encoding + WebCodecs) ───────

let _saveHandle = null
let _saveFilename = null

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

const BATCH_SIZE = 20

// WebCodecs encoder state
let _wcEncoder = null
let _wcMuxer = null
let _wcFrameIndex = 0
let _wcConfig = null
let _wcMuxerClass = null

function getExportMode() {
  try { return localStorage.getItem('exportEncoding') || 'webp-batch' } catch { return 'webp-batch' }
}

function getWebpQuality() {
  try { return parseFloat(localStorage.getItem('exportWebpQuality')) || 0.9 } catch { return 0.9 }
}

function getJpegQuality() {
  try { return parseFloat(localStorage.getItem('exportJpegQuality')) || 0.2 } catch { return 0.2 }
}

async function encodeViaWebCodecs(canvas, frameIndex) {
  const cfg = _wcConfig || {}
  const fps = cfg.fps || 30

  if (!_wcEncoder) {
    try {
      const { Muxer } = await import('mp4-muxer')
      _wcMuxerClass = Muxer
    } catch (err) {
      console.error('WebCodecs init: failed to load mp4-muxer', err)
      // Fall back to a server mode
      _wcEncoder = 'FAILED'
      throw new Error(`mp4-muxer import failed: ${err.message}`)
    }

    const w = canvas.width, h = canvas.height

    try {
      _wcMuxer = new (_wcMuxerClass)({
        fastStart: 'in-memory',
        video: { width: w, height: h, codec: 'avc1.42001E' },
      })
    } catch (err) {
      _wcEncoder = 'FAILED'
      throw new Error(`Muxer creation failed: ${err.message}`)
    }

    try {
      _wcEncoder = new VideoEncoder({
        output: (chunk, meta) => _wcMuxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      })
      _wcEncoder.configure({
        codec: 'avc1.42001E',
        width: w,
        height: h,
        bitrate: (cfg.bitrateKbps || 5000) * 1000,
        framerate: fps,
      })
    } catch (err) {
      // Cleanup on failure
      try { _wcEncoder?.close() } catch {}
      _wcEncoder = 'FAILED'
      throw new Error(`VideoEncoder init failed: ${err.message}`)
    }
    _wcFrameIndex = 0
  }

  if (_wcEncoder === 'FAILED') return

  try {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const frame = new VideoFrame(imageData.data.buffer, {
      format: 'RGBA',
      codedWidth: canvas.width,
      codedHeight: canvas.height,
      timestamp: _wcFrameIndex * 1e6 / fps,
      duration: 1e6 / fps,
    })
    _wcEncoder.encodeFrame(frame)
    frame.close()
    _wcFrameIndex++
  } catch (err) {
    throw new Error(`VideoFrame/encode error: ${err.message}`)
  }
}

function createWebPlatform(projectHandle) {
  let sessionId = null
  let frameBatch = []

  return {
    type: 'web',
    projectHandle,
    isElectron: false,

    async createExportDirs() {
      const mode = getExportMode()
      if (mode === 'webcodecs-mp4') {
        return { outputFolder: '', tempFolder: '', framesFolder: '' }
      }
      const res = await fetch(`${EXPORT_API}/create-session`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create export session on server')
      const data = await res.json()
      sessionId = data.sessionId
      return { outputFolder: sessionId, tempFolder: sessionId, framesFolder: sessionId }
    },

    // Called within user gesture — pre-pick the save location
    async resolveOutputPath(defaultPath, ext) {
      const filename = defaultPath.split('/').pop() || `export.${ext}`
      _saveFilename = filename

      if (typeof window.showSaveFilePicker === 'function') {
        try {
          _saveHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Video file',
              accept: Object.fromEntries(
                ['mp4', 'webm', 'mov'].map(e => [MIME[e], ['.' + e]])
              ),
            }],
          })
          return _saveHandle.name
        } catch (err) {
          if (err.name === 'AbortError') { _saveHandle = null; return null }
          _saveHandle = null
        }
      }
      return filename
    },

    canUseDirectFramePipe: false,

    async startFramePipe(opts) {
      // Store config for WebCodecs (even though pipe itself isn't used)
      _wcConfig = opts
      return null
    },

    async writeFrameToPipe() { return false },

    async finishFramePipe() { return null },

    async abortFramePipe() {},

    async writeFrame(canvas, _dirHandle, index, fps) {
      const mode = getExportMode()

      if (mode === 'webcodecs-mp4') {
        if (!_wcConfig) _wcConfig = { fps: fps || 30, bitrateKbps: 5000 }
        await encodeViaWebCodecs(canvas, index)
        return
      }

      const toBlob = (mime, q) => new Promise(resolve => canvas.toBlob(resolve, mime, q))

      if (mode === 'webp-batch') {
        const blob = await toBlob('image/webp', getWebpQuality())
        frameBatch.push({ index, blob })
        if (frameBatch.length >= BATCH_SIZE) await this.flushFrames()
        return
      }

      if (mode === 'jpeg-batch') {
        const blob = await toBlob('image/jpeg', getJpegQuality())
        frameBatch.push({ index, blob })
        if (frameBatch.length >= BATCH_SIZE) await this.flushFrames()
        return
      }

      if (mode === 'webp-single') {
        const blob = await toBlob('image/webp', getWebpQuality())
        await fetch(`${EXPORT_API}/upload-frame/${sessionId}/${index}`, {
          method: 'POST',
          body: await blob.arrayBuffer(),
        })
        return
      }

      if (mode === 'jpeg-single') {
        const blob = await toBlob('image/jpeg', getJpegQuality())
        await fetch(`${EXPORT_API}/upload-frame/${sessionId}/${index}`, {
          method: 'POST',
          body: await blob.arrayBuffer(),
        })
        return
      }

      // png-single
      const blob = await toBlob('image/png')
      await fetch(`${EXPORT_API}/upload-frame/${sessionId}/${index}`, {
        method: 'POST',
        body: await blob.arrayBuffer(),
      })
    },

    async flushFrames() {
      if (frameBatch.length === 0) return
      const batch = frameBatch
      frameBatch = []
      await Promise.all(batch.map(({ index, blob }) =>
        blob.arrayBuffer().then(buf =>
          fetch(`${EXPORT_API}/upload-frame/${sessionId}/${index}`, { method: 'POST', body: buf })
        )
      ))
    },

    async writeFrameAsPng(_dirHandle, index, buffer) {
      await fetch(`${EXPORT_API}/upload-frame/${sessionId}/${index}`, {
        method: 'POST',
        body: buffer,
      })
    },

    getFramePattern() { return 'frame_%06d.png' },

    getAudioPath() { return 'audio.wav' },

    getPipedVideoPath() { return null },

    async mixAudio() { return null },

    async writeAudioWav(_tempFolder, wavData) {
      await fetch(`${EXPORT_API}/upload-audio/${sessionId}`, {
        method: 'POST',
        body: wavData,
      })
      return 'audio.wav'
    },

    async encodeVideo(opts) {
      // WebCodecs path: finalize encoder + muxer and save
      if (_wcEncoder === 'FAILED') {
        _wcEncoder = null; _wcMuxer = null; _wcConfig = null; _wcFrameIndex = 0
        return { success: false, error: 'WebCodecs encoder failed to initialize' }
      }
      if (_wcMuxer) {
        try {
          await _wcEncoder.flush()
          _wcEncoder.close()
          const mp4Buf = _wcMuxer.finalize()
          _wcEncoder = null; _wcMuxer = null; _wcConfig = null; _wcFrameIndex = 0

          const blob = new Blob([mp4Buf], { type: 'video/mp4' })
          const ext = opts.format || 'mp4'
          const filename = opts.outputPath || _saveFilename || `export.${ext}`

          if (_saveHandle) {
            const h = _saveHandle; _saveHandle = null
            const writable = await h.createWritable()
            await writable.write(blob)
            await writable.close()
            return { success: true, outputPath: _saveFilename || filename, encoderUsed: 'WebCodecs H.264' }
          }
          downloadBlob(blob, filename)
          return { success: true, outputPath: filename, encoderUsed: 'WebCodecs H.264' }
        } catch (err) {
          console.error('WebCodecs encoding failed:', err)
          _wcEncoder = null; _wcMuxer = null; _wcConfig = null; _wcFrameIndex = 0
          return { success: false, error: err.message || 'WebCodecs encoding failed' }
        }
      }

      // Server encoding path
      if (!sessionId) return { success: false, error: 'No export session — use WebCodecs or server mode' }

      try {
        const res = await fetch(`${EXPORT_API}/encode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, ...opts }),
        })
        if (!res.ok) {
          const text = await res.text()
          let msg
          try { msg = JSON.parse(text).error || text } catch { msg = text }
          throw new Error(msg || `Server encode failed (${res.status})`)
        }
        const blob = await res.blob()
        const ext = opts.format || 'mp4'
        const filename = opts.outputPath || _saveFilename || `export.${ext}`

        if (_saveHandle) {
          const h = _saveHandle; _saveHandle = null
          const writable = await h.createWritable()
          await writable.write(blob)
          await writable.close()
          return { success: true, outputPath: _saveFilename || filename, encoderUsed: 'server-ffmpeg' }
        }

        downloadBlob(blob, filename)
        return { success: true, outputPath: filename, encoderUsed: 'server-ffmpeg' }
      } catch (err) {
        console.error('Server encoding failed:', err)
        return { success: false, error: err.message || 'Server encoding failed' }
      }
    },

    async muxAudioVideo() {
      return { success: false, error: 'Muxing not supported in web mode, use encodeVideo' }
    },

    async copyFile() {
      return { success: false, error: 'File copy not supported in web mode' }
    },

    async cleanup() {
      if (_wcEncoder) { try { _wcEncoder.close() } catch {}; _wcEncoder = null }
      _wcMuxer = null; _wcConfig = null; _wcFrameIndex = 0
      if (sessionId) {
        try { await fetch(`${EXPORT_API}/cleanup/${sessionId}`, { method: 'POST' }) } catch {}
        sessionId = null
      }
    },

    async resolveAssetUrl(asset) {
      return asset?.url || null
    },

    async resolveProxyUrl(asset) {
      return asset?.proxyUrl || null
    },

    async resolveCacheUrl(clip) {
      if (clip.cacheUrl) return clip.cacheUrl
      if (clip.cachePath && projectHandle) {
        try {
          const file = await readProjectFileByPath(projectHandle, clip.cachePath)
          return URL.createObjectURL(file)
        } catch {}
      }
      return null
    },
  }
}

async function readProjectFileByPath(projectDir, relativePath) {
  const parts = relativePath.split('/')
  let currentDir = projectDir
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i])
  }
  const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1])
  return await fileHandle.getFile()
}
