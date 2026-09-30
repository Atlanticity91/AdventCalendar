import { useSyncExternalStore } from 'react'

// Module-level listeners set
const listeners = new Set<() => void>()

// One popstate listener that notifies all listeners
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    listeners.forEach((l) => l())
  })
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot( name: string ): string | null {
  return new URLSearchParams( window.location.search ).get( name )
}

function setParam( name: string, value: string | null ) {
  const params = new URLSearchParams( window.location.search )
  
  if (value === null)
    params.delete(name)
  else
    params.set( name, value )

  const qs = params.toString()
  const url = window.location.pathname + (qs ? `?${qs}` : '')
  window.history.pushState(null, '', url)
  // pushState fires no event, so notify manually
  listeners.forEach((l) => l())
}

export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => getSnapshot(name),
    () => getSnapshot(name)
  )

  return [value, (v) => setParam(name, v)]
}

// --- User hook ---

const USER_RE = /^[a-z0-9_-]{1,32}$/i

export function useUser(): string {
  const [userParam] = useQueryParam('user')

  if ( userParam && USER_RE.test( userParam ) )
    return userParam.toLowerCase( )

  return 'default'
}
