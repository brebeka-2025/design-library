import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Shell from './components/Shell'
import Library from './pages/Library'
import Review from './pages/Review'
import Brands from './pages/Brands'
import StyleProfile from './pages/StyleProfile'
import TheCrit from './pages/TheCrit'
import Guide from './pages/Guide'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/review" element={<Review />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/profile" element={<StyleProfile />} />
        <Route path="/crit" element={<TheCrit />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
