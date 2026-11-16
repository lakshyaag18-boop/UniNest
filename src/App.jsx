import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AuthGate from './components/AuthGate'
import { Logo } from './components/Brand'
import Footer from './components/Footer'
import Sidebar from './components/Sidebar'
import ChatPage from './pages/ChatPage'
import HomePage from './pages/HomePage'
import NestEggPage from './pages/NestEggPage'
import {
  demoMode,
  getDemoSession,
  getInitialSession,
  listGroups,
  loadProfile,
  onAuthChange,
  signInDemo,
  signOutDemo,
  signOutStudent,
  updateDemoName,
  updateDisplayName,
} from './lib/store'

export default function App() {
  const [demoSession, setDemoSession] = useState(() => (demoMode ? getDemoSession() : null))
  const [session, setSession] = useState(null)
  const [booting, setBooting] = useState(!demoMode)
  const [profileName, setProfileName] = useState('')
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState('')
  const location = useLocation()

  const user = session?.user ?? null
  const userId = demoMode ? demoSession?.userId : user?.id
  const displayName = demoMode ? demoSession?.displayName || '' : profileName

  useEffect(() => {
    if (demoMode) return undefined
    let active = true

    getInitialSession()
      .then((initial) => {
        if (!active) return
        setSession(initial)
        setBooting(false)
      })
      .catch(() => {
        if (active) setBooting(false)
      })

    const unsubscribe = onAuthChange((next) => {
      if (active) setSession(next)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (demoMode) return undefined
    if (!userId) {
      setProfileName('')
      return undefined
    }

    let active = true
    const fallback =
      user?.user_metadata?.display_name || (user?.email || 'Student').split('@')[0]

    loadProfile(userId)
      .then((profile) => {
        if (active) setProfileName(profile?.display_name || fallback)
      })
      .catch(() => {
        if (active) setProfileName(fallback)
      })

    return () => {
      active = false
    }
    // The session object is stable per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const refreshGroups = useCallback(async () => {
    if (!demoMode && !userId) {
      setGroups([])
      return
    }
    setGroupsLoading(true)
    setGroupsError('')
    try {
      setGroups(await listGroups())
    } catch (err) {
      setGroupsError(err.message || 'Could not load your groups.')
    } finally {
      setGroupsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refreshGroups()
  }, [refreshGroups])

  const handleGroup = useCallback((group) => {
    setGroups((prev) => [group, ...prev.filter((entry) => entry.id !== group.id)])
  }, [])

  const handleDemoLogin = useCallback(async ({ displayName: name, email }) => {
    const next = signInDemo({ displayName: name, email })
    setDemoSession(next)
  }, [])

  const handleName = useCallback(
    async (name) => {
      if (!name?.trim()) throw new Error('Enter a name.')
      if (demoMode) {
        setDemoSession(updateDemoName(name))
        return
      }
      const updated = await updateDisplayName(userId, name)
      setProfileName(updated.display_name)
    },
    [userId],
  )

  const handleSignOut = useCallback(async () => {
    if (demoMode) {
      signOutDemo()
      setDemoSession(null)
      setGroups([])
      setGroupsError('')
      return
    }
    try {
      await signOutStudent()
    } catch (error) {
      console.error('Sign out failed', error)
    }
    setProfileName('')
    setGroups([])
    setGroupsError('')
  }, [])

  if (booting) return <Splash />
  if (demoMode && !demoSession) return <AuthGate demo onDemoLogin={handleDemoLogin} />
  if (!demoMode && !session) return <AuthGate />
  if (!displayName) return <Splash />

  const isHome = location.pathname === '/'

  return (
    <div className="flex h-[100dvh] flex-col bg-cream text-ink">
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${
            isHome ? 'flex' : 'hidden md:flex'
          } w-full shrink-0 flex-col border-line bg-cream-2/40 md:w-[310px] md:border-r lg:w-[340px]`}
        >
          <Sidebar
            groups={groups}
            groupsLoading={groupsLoading}
            groupsError={groupsError}
            displayName={displayName}
            onGroup={handleGroup}
            onRename={handleName}
            onSignOut={handleSignOut}
          />
        </aside>

        <main className={`${isHome ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/g/:groupId"
              element={
                <ChatPage
                  groups={groups}
                  displayName={displayName}
                  userId={userId}
                  onGroup={handleGroup}
                />
              }
            />
            <Route path="/nest-egg" element={<NestEggPage displayName={displayName} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Footer />
    </div>
  )
}

function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-cream">
      <Logo className="size-14" />
      <Loader2 className="size-5 animate-spin text-sage" />
    </div>
  )
}
