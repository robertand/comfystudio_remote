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

    async writeFrameAsPng(dirHandle, index, buffer) {
      const framePath = await api.pathJoin(dirHandle, `frame_${String(index + 1).padStart(6, '0')}.png`)
      await api.writeFileFromArrayBuffer(framePath, buffer)
    },

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

// ── Web platform (remote, server-side encoding) ───────────────────

let _saveHandle = null
let _saveFilename = null

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

function createWebPlatform(projectHandle) {
  let sessionId = null

  return {
    type: 'web',
    projectHandle,
    isElectron: false,

    async createExportDirs() {
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

    async startFramePipe() { return null },

    async writeFrameToPipe() { return false },

    async finishFramePipe() { return null },

    async abortFramePipe() {},

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
      try {
        const res = await fetch(`${EXPORT_API}/encode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, ...opts }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || `Server encode failed (${res.status})`)
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
