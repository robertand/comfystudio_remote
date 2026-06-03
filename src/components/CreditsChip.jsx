import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Coins, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'
import {
  getComfyPartnerApiKey,
  openComfyPartnerCreditsPage,
  COMFY_PARTNER_KEY_CHANGED_EVENT,
  COMFY_PARTNER_CREDITS_LOW_EVENT,
} from '../services/comfyPartnerAuth'
import { comfyui } from '../services/comfyui'

/**
 * CreditsChip
 *
 * A compact status pill that surfaces the user's Comfy.org partner credit
 * balance — or, when the balance isn't queryable (which is the case today
 * because Comfy.org doesn't expose a public credit-balance endpoint yet),
 * gives the user a one-click deep-link to their dashboard.
 *
 * Behaviour:
 *   - If no API key is configured, the chip renders nothing. (Pure local
 *     users shouldn't see credits noise.)
 *   - On mount & every 2 minutes, we opportunistically query the balance
 *     via `comfyui.getComfyOrgCreditBalance()`. The second the Comfy team
 *     ships `GET /api/user/credits`, this flips from "Credits ↗" into a
 *     live number without any UI change required here.
 *   - A failed queue submission anywhere in the app can dispatch the
 *     `COMFY_PARTNER_CREDITS_LOW_EVENT` and this chip flips into an amber
 *     "Out of credits" state immediately.
 *   - Clicking the chip always opens platform.comfy.org/profile in the
 *     user's default browser, so the live number is one click away.
 */
function CreditsChip({ className = '', size = 'sm' }) {
  const [hasKey, setHasKey] = useState(false)
  const [balance, setBalance] = useState({
    status: 'idle',   // 'idle' | 'loading' | 'ok' | 'unknown' | 'low'
    credits: null,
  })
  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)

  const refreshBalance = useCallback(async () => {
    try {
      setBalance((prev) => ({ ...prev, status: prev.status === 'low' ? 'low' : 'loading' }))
      const result = await comfyui.getComfyOrgCreditBalance()
      if (!mountedRef.current) return

      // `status: 'ok'` is the only case where the server actually returned
      // a number. Every other status ('available-no-credit-field',
      // 'not-supported', 'unavailable', 'auth-failed', 'missing-key') means
      // we can't show a live number, so we fall back to the deep-link.
      if (result?.status === 'ok' && Number.isFinite(result.credits)) {
        setBalance({ status: 'ok', credits: result.credits })
      } else {
        setBalance((prev) => prev.status === 'low'
          ? prev
          : { status: 'unknown', credits: null })
      }
    } catch (_) {
      if (!mountedRef.current) return
      setBalance((prev) => prev.status === 'low'
        ? prev
        : { status: 'unknown', credits: null })
    }
  }, [])

  // Track API-key presence; re-evaluate when the user adds/removes a key.
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    const load = async () => {
      const key = await getComfyPartnerApiKey()
      if (cancelled) return
      setHasKey(Boolean(key))
    }
    load()

    const onKeyChanged = () => { load() }
    window.addEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, onKeyChanged)

    return () => {
      cancelled = true
      mountedRef.current = false
      window.removeEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, onKeyChanged)
    }
  }, [])

  // When the key appears, kick off balance polling. Stop polling when the
  // key is removed so we don't hammer the endpoint with doomed requests.
  useEffect(() => {
    if (!hasKey) {
      setBalance({ status: 'idle', credits: null })
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    refreshBalance()
    pollTimerRef.current = setInterval(refreshBalance, 2 * 60 * 1000)
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [hasKey, refreshBalance])

  // Flip into "low" state the moment any surface dispatches the event.
  useEffect(() => {
    const onLow = () => {
      setBalance({ status: 'low', credits: null })
    }
    window.addEventListener(COMFY_PARTNER_CREDITS_LOW_EVENT, onLow)
    return () => window.removeEventListener(COMFY_PARTNER_CREDITS_LOW_EVENT, onLow)
  }, [])

  const handleClick = useCallback((e) => {
    e.preventDefault?.()
    e.stopPropagation?.()
    openComfyPartnerCreditsPage()
  }, [])

  const labelPieces = useMemo(() => {
    if (balance.status === 'low') {
      return {
        label: 'Out of credits',
        tooltip: 'A recent job failed because your Comfy.org credit balance is exhausted. Click to top up.',
      }
    }
    if (balance.status === 'ok' && Number.isFinite(balance.credits)) {
      return {
        label: `${formatCreditCount(balance.credits)} credits`,
        tooltip: `Live balance from Comfy.org. Click to open the full credits dashboard.`,
      }
    }
    if (balance.status === 'loading') {
      return {
        label: 'Credits',
        tooltip: 'Checking your Comfy.org credit balance…',
      }
    }
    return {
      label: 'Credits',
      tooltip: "Live balance isn't exposed by Comfy.org yet. Click to view your balance on the dashboard.",
    }
  }, [balance])

  if (!hasKey) return null

  const isLow = balance.status === 'low'
  const isLive = balance.status === 'ok'
  const isLoading = balance.status === 'loading'

  const sizeClasses = size === 'xs'
    ? 'h-6 px-2 text-[10.5px] gap-1'
    : 'h-7 px-2.5 text-[11px] gap-1.5'

  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={labelPieces.tooltip}
      className={`flex items-center rounded-md font-medium transition-colors border ${sizeClasses} ${
        isLow
          ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-100'
          : isLive
            ? 'bg-sf-dark-800 hover:bg-sf-dark-700 border-sf-dark-700 text-sf-text-primary'
            : 'bg-sf-dark-800 hover:bg-sf-dark-700 border-sf-dark-700 text-sf-text-secondary'
      } ${className}`}
    >
      {isLow ? (
        <AlertTriangle className={`${iconSize} text-amber-300 flex-shrink-0`} />
      ) : isLoading ? (
        <Loader2 className={`${iconSize} animate-spin flex-shrink-0`} />
      ) : (
        <Coins className={`${iconSize} flex-shrink-0 ${isLive ? 'text-amber-300' : 'text-sf-text-muted'}`} />
      )}
      <span className="whitespace-nowrap">{labelPieces.label}</span>
      <ExternalLink className={`${iconSize} flex-shrink-0 opacity-60`} />
    </button>
  )
}

function formatCreditCount(n) {
  if (!Number.isFinite(n)) return '—'
  // Match the dashboard's display style: 3,004.00
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export default CreditsChip
