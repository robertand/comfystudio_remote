import { useEffect, useRef, useState, useMemo } from 'react'
import useTimelineStore from '../stores/timelineStore'
import useAssetsStore from '../stores/assetsStore'
import { getAudioClipFadeGain } from '../utils/audioClipFades'
import { getAudioClipLinearGain } from '../utils/audioClipGain'

const METER_MIN_DB = -40
const METER_MAX_DB = 0
const METER_DB_TICKS = [0, -5, -10, -15, -20, -25, -30, -35, -40]

const dbToFillPercent = (db) => {
  const normalizedDb = Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, Number(db) || METER_MIN_DB))
  return ((normalizedDb - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100
}

/**
 * MasterAudioMeter - Stereo VU meter component for timeline audio
 * Analyzes audio levels from active audio clips
 */
function MasterAudioMeter({ height, className = '' }) {
  const [leftLevel, setLeftLevel] = useState(METER_MIN_DB) // dB
  const [leftPeak, setLeftPeak] = useState(METER_MIN_DB) // dB
  const [rightLevel, setRightLevel] = useState(METER_MIN_DB) // dB
  const [rightPeak, setRightPeak] = useState(METER_MIN_DB) // dB
  
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const audioElementsRef = useRef(new Map()) // clipId -> { audioEl, source, gainNode }
  const peakHoldRef = useRef({ left: METER_MIN_DB, right: METER_MIN_DB })
  const peakHoldTimeoutRef = useRef({ left: null, right: null })
  const isPlayingRef = useRef(false)
  
  const {
    clips,
    tracks,
    playheadPosition,
    isPlaying,
    getActiveClipsAtTime,
  } = useTimelineStore()
  
  const getAssetById = useAssetsStore(state => state.getAssetById)
  const meterTicks = useMemo(
    () => METER_DB_TICKS.map((db) => ({
      db,
      top: db === METER_MIN_DB ? 'calc(100% - 1px)' : `${100 - dbToFillPercent(db)}%`,
      isMajor: db % 10 === 0,
    })),
    []
  )
  
  // Get active audio clips
  const activeAudioClips = useMemo(() => {
    const allActive = getActiveClipsAtTime(playheadPosition)
    return allActive
      .filter(({ track }) => track.type === 'audio' && track.visible && !track.muted)
      .map(({ clip, track }) => ({ clip, track }))
  }, [playheadPosition, getActiveClipsAtTime, tracks])
  
  // Initialize Web Audio API context and analyzer
  useEffect(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.2
      
      // Create a master gain node for mixing all sources
      // Note: We don't connect to destination to avoid double playback
      // AudioLayerRenderer handles actual playback
      const masterGain = audioContext.createGain()
      masterGain.connect(analyser)
      // Don't connect analyser to destination - we only want to analyze, not play
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      dataArrayRef.current = dataArray
      masterGainRef.current = masterGain
    } catch (err) {
      console.warn('Failed to initialize audio analyzer:', err)
    }
    
    return () => {
      if (peakHoldTimeoutRef.current.left) {
        clearTimeout(peakHoldTimeoutRef.current.left)
      }
      if (peakHoldTimeoutRef.current.right) {
        clearTimeout(peakHoldTimeoutRef.current.right)
      }
      // Cleanup audio sources
      audioElementsRef.current.forEach(({ source, audioEl }) => {
        try {
          source?.disconnect()
          audioEl.pause()
          audioEl.src = ''
        } catch (e) {}
      })
      audioElementsRef.current.clear()
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])
  
  const masterGainRef = useRef(null)
  
  // Keep ref in sync for async handlers that may fire after transport state changes.
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Keep analyzer and hidden media elements in lockstep with transport start/stop.
  useEffect(() => {
    const ctx = audioContextRef.current
    if (ctx) {
      if (isPlaying && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      } else if (!isPlaying && ctx.state === 'running') {
        ctx.suspend().catch(() => {})
      }
    }

    if (!isPlaying) {
      audioElementsRef.current.forEach(({ gainNode, audioEl }) => {
        try {
          if (gainNode) gainNode.gain.value = 0
          audioEl.pause()
        } catch (_) {}
      })

      if (peakHoldTimeoutRef.current.left) {
        clearTimeout(peakHoldTimeoutRef.current.left)
        peakHoldTimeoutRef.current.left = null
      }
      if (peakHoldTimeoutRef.current.right) {
        clearTimeout(peakHoldTimeoutRef.current.right)
        peakHoldTimeoutRef.current.right = null
      }

      peakHoldRef.current = { left: METER_MIN_DB, right: METER_MIN_DB }
      setLeftLevel(METER_MIN_DB)
      setRightLevel(METER_MIN_DB)
      setLeftPeak(METER_MIN_DB)
      setRightPeak(METER_MIN_DB)
    }
  }, [isPlaying])
  
  // Connect/disconnect audio sources based on active clips
  useEffect(() => {
    if (!audioContextRef.current || !masterGainRef.current) return
    
    const audioContext = audioContextRef.current
    const masterGain = masterGainRef.current
    const audioElements = audioElementsRef.current
    
    // Remove sources for clips that are no longer active
    const activeClipIds = new Set(activeAudioClips.map(({ clip }) => clip.id))
    for (const [clipId, { source, gainNode, audioEl }] of audioElements.entries()) {
      if (!activeClipIds.has(clipId)) {
        try {
          source?.disconnect()
          gainNode?.disconnect()
          audioEl.pause()
          audioEl.src = ''
          audioElements.delete(clipId)
        } catch (e) {}
      }
    }
    
    // Create/update sources for active clips
    activeAudioClips.forEach(({ clip, track }) => {
      const asset = getAssetById(clip.assetId)
      if (!asset?.url) return
      
      let sourceData = audioElements.get(clip.id)
      
      if (!sourceData) {
        // Create new audio element
        const audioEl = new Audio()
        audioEl.preload = 'auto'
        audioEl.crossOrigin = 'anonymous'
        audioEl.src = asset.url
        
        // Wait for audio to load before creating source
        const onLoadedData = () => {
          try {
            const source = audioContext.createMediaElementSource(audioEl)
            const gainNode = audioContext.createGain()
            source.connect(gainNode)
            gainNode.connect(masterGain)
            
            audioElements.set(clip.id, { source, gainNode, audioEl })
            
            // Sync playback
            const clipTime = playheadPosition - clip.startTime
            const sourceTime = (clip.trimStart || 0) + clipTime
            const maxTime = clip.sourceDuration || clip.trimEnd || clip.duration
            const clampedTime = Math.max(0, Math.min(sourceTime, maxTime - 0.01))
            
            const clipEnd = clip.startTime + clip.duration
            const isWithinClip = playheadPosition >= clip.startTime && playheadPosition < clipEnd
            
            // Play audio for analysis (but it's not connected to speakers)
            // AudioLayerRenderer handles actual playback
            if (isWithinClip && isPlayingRef.current) {
              audioEl.currentTime = clampedTime
              audioEl.play().catch(() => {})
            }
            // Keep volume 1 for analysis; the analyser path does not render to speakers.
            audioEl.volume = 1
            
            const trackGain = track.volume !== undefined
              ? Math.max(0, Number(track.volume) || 0) / 100
              : 1
            gainNode.gain.value = getAudioClipLinearGain(clip) * trackGain * getAudioClipFadeGain(clip, clipTime)
          } catch (err) {
            console.warn('Failed to create audio source:', err)
          }
          audioEl.removeEventListener('loadeddata', onLoadedData)
        }
        audioEl.addEventListener('loadeddata', onLoadedData)
      } else {
        // Update existing source
        const { gainNode, audioEl } = sourceData
        
        // Sync playback
        const clipTime = playheadPosition - clip.startTime
        const sourceTime = (clip.trimStart || 0) + clipTime
        const maxTime = clip.sourceDuration || clip.trimEnd || clip.duration
        const clampedTime = Math.max(0, Math.min(sourceTime, maxTime - 0.01))
        
        const clipEnd = clip.startTime + clip.duration
        const isWithinClip = playheadPosition >= clip.startTime && playheadPosition < clipEnd
        
        if (audioEl.readyState >= 2) {
          const timeDiff = Math.abs(audioEl.currentTime - clampedTime)
          if (timeDiff > 0.1) {
            audioEl.currentTime = clampedTime
          }
          
          // Sync playback for analysis (muted, AudioLayerRenderer handles actual playback)
          if (isPlaying && isWithinClip) {
            if (audioEl.paused) {
              audioEl.play().catch(() => {})
            }
          } else {
            if (!audioEl.paused) {
              audioEl.pause()
            }
          }
          // Keep volume 1 for analysis (analyser not connected to destination)
          audioEl.volume = 1
        }
        
        const trackGain = track.volume !== undefined
          ? Math.max(0, Number(track.volume) || 0) / 100
          : 1
        gainNode.gain.value = getAudioClipLinearGain(clip) * trackGain * getAudioClipFadeGain(clip, clipTime)
      }
    })
  }, [activeAudioClips, playheadPosition, isPlaying, getAssetById])
  
  // Analysis loop: use setInterval so it keeps running (rAF can be throttled when tab inactive or no interaction)
  const METER_UPDATE_MS = 50 // ~20 fps, enough for smooth meter
  useEffect(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const analyze = () => {
      try {
        const hasLivePlayback = Array.from(audioElementsRef.current.values()).some(
          ({ audioEl }) => audioEl && !audioEl.paused && !audioEl.ended
        )
        if (!isPlayingRef.current || !hasLivePlayback) {
          setLeftLevel(METER_MIN_DB)
          setRightLevel(METER_MIN_DB)
          return
        }

        const fftSize = analyser.fftSize
        const floatData = new Float32Array(fftSize)
        analyser.getFloatTimeDomainData(floatData)

        let sum = 0
        for (let i = 0; i < floatData.length; i++) {
          sum += floatData[i] * floatData[i]
        }
        const rms = floatData.length > 0 ? Math.sqrt(sum / floatData.length) : 0
        const leftDb = rms > 0.001 ? Math.max(METER_MIN_DB, 20 * Math.log10(rms)) : METER_MIN_DB
        const rightDb = leftDb

        setLeftLevel(leftDb)
        setRightLevel(rightDb)

        if (leftDb > peakHoldRef.current.left) {
          peakHoldRef.current.left = leftDb
          if (peakHoldTimeoutRef.current.left) clearTimeout(peakHoldTimeoutRef.current.left)
          peakHoldTimeoutRef.current.left = setTimeout(() => {
            peakHoldRef.current.left = METER_MIN_DB
            setLeftPeak(METER_MIN_DB)
          }, 1000)
          setLeftPeak(leftDb)
        }
        if (rightDb > peakHoldRef.current.right) {
          peakHoldRef.current.right = rightDb
          if (peakHoldTimeoutRef.current.right) clearTimeout(peakHoldTimeoutRef.current.right)
          peakHoldTimeoutRef.current.right = setTimeout(() => {
            peakHoldRef.current.right = METER_MIN_DB
            setRightPeak(METER_MIN_DB)
          }, 1000)
          setRightPeak(rightDb)
        }
      } catch (_) {}
    }

    analyze()
    const intervalId = setInterval(analyze, METER_UPDATE_MS)

    return () => clearInterval(intervalId)
  }, [])
  
  // Get color for a given dB level
  const getColorForDb = (db) => {
    if (db >= -4) return 'bg-red-500' // Red for peaks (0 to -4 dB)
    if (db >= -12) return 'bg-yellow-500' // Yellow for warning (-4 to -12 dB)
    return 'bg-green-500' // Green for normal (-12 to -40 dB)
  }
  
  const leftPosition = dbToFillPercent(leftLevel)
  const rightPosition = dbToFillPercent(rightLevel)
  const leftPeakPosition = dbToFillPercent(leftPeak)
  const rightPeakPosition = dbToFillPercent(rightPeak)
  
  return (
    <div className={`flex flex-col items-center bg-sf-dark-800 ${className}`} style={{ width: height ? undefined : '100%', height: height ? `${height}px` : '100%', minHeight: 120 }}>
      {/* Layout: left bar | scale (centered) | right bar */}
      <div className="flex-1 flex items-stretch gap-0 min-h-0 w-full max-w-[92px] px-1">
        {/* Left channel */}
        <div className="flex-1 min-w-0 min-h-0 relative bg-black/50 rounded-l-sm overflow-hidden border border-sf-dark-600 border-r-0">
          <div className="absolute inset-0 pointer-events-none">
            {meterTicks.map(({ db, top, isMajor }) => (
              <div
                key={`left-${db}`}
                className={`absolute left-0 right-0 border-t ${
                  isMajor ? 'border-white/18' : 'border-white/8'
                }`}
                style={{ top }}
              />
            ))}
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 ${getColorForDb(leftLevel)} transition-all duration-75`}
            style={{ height: `${leftPosition}%` }}
          />
          {leftPeak > METER_MIN_DB && (
            <div
              className="absolute left-0 right-0 bg-red-500"
              style={{ bottom: `${leftPeakPosition}%`, height: '2px' }}
            />
          )}
        </div>
        
        {/* dB scale - centered between the two bars */}
        <div className="relative py-0.5 text-[8px] text-sf-text-muted font-mono pointer-events-none shrink-0 w-8">
          {meterTicks.map(({ db, top, isMajor }) => (
            <div
              key={`scale-${db}`}
              className="absolute inset-x-0 flex items-center justify-center"
              style={{
                top,
                transform: db === 0 ? 'translateY(0)' : (db === METER_MIN_DB ? 'translateY(-100%)' : 'translateY(-50%)'),
              }}
            >
              <div className={`h-px w-1.5 mr-1 ${isMajor ? 'bg-white/25' : 'bg-white/12'}`} />
              <span className={isMajor ? 'text-sf-text-secondary' : 'text-sf-text-muted'}>{db}</span>
            </div>
          ))}
        </div>
        
        {/* Right channel */}
        <div className="flex-1 min-w-0 min-h-0 relative bg-black/50 rounded-r-sm overflow-hidden border border-sf-dark-600 border-l-0">
          <div className="absolute inset-0 pointer-events-none">
            {meterTicks.map(({ db, top, isMajor }) => (
              <div
                key={`right-${db}`}
                className={`absolute left-0 right-0 border-t ${
                  isMajor ? 'border-white/18' : 'border-white/8'
                }`}
                style={{ top }}
              />
            ))}
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 ${getColorForDb(rightLevel)} transition-all duration-75`}
            style={{ height: `${rightPosition}%` }}
          />
          {rightPeak > METER_MIN_DB && (
            <div
              className="absolute left-0 right-0 bg-red-500"
              style={{ bottom: `${rightPeakPosition}%`, height: '2px' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default MasterAudioMeter
