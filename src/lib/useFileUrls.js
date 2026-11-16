import { useEffect, useMemo, useState } from 'react'
import { signFileUrls } from './store'

/**
 * Resolves a list of storage paths to signed URLs (cached per path for the
 * lifetime of the view). Re-runs only when the set of paths changes.
 */
export function useFileUrls(paths) {
  const list = useMemo(() => [...new Set((paths || []).filter(Boolean))], [paths])
  const key = list.join('|')
  const [urls, setUrls] = useState({})

  useEffect(() => {
    if (!key) return undefined
    let active = true
    signFileUrls(key.split('|'))
      .then((map) => {
        if (active) setUrls((prev) => ({ ...prev, ...map }))
      })
      .catch(() => {
        // A missing/expired file simply renders without a link.
      })
    return () => {
      active = false
    }
  }, [key])

  return urls
}
