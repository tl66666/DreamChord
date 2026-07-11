import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getMe } from './api/client'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FeedbackProvider } from './components/FeedbackProvider'

const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const AIWriterPage = lazy(() => import('./pages/AIWriterPage'))

function AuthInitializer() {
  const { token, setUser, setLoading, logout } = useAuthStore()

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    getMe()
      .then((user) => setUser(user))
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [token, setUser, setLoading, logout])

  return null
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-dream-50 via-white to-chord-blue/5">
      <div className="rounded-lg border border-dream-100 bg-white/80 px-4 py-3 text-sm text-dream-700 shadow-sm backdrop-blur">
        加载 DreamChord...
      </div>
    </div>
  )
}

/** 路由守卫：未登录用户重定向到登录页 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <div className="min-h-screen bg-gradient-to-br from-dream-50 via-white to-chord-blue/5">
          <AuthInitializer />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/editor/:projectId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
              <Route path="/play/:projectId" element={<PlayerPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
              <Route path="/agent" element={<ProtectedRoute><AIWriterPage /></ProtectedRoute>} />
              <Route path="/ai-writer" element={<Navigate to="/agent" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </FeedbackProvider>
    </ErrorBoundary>
  )
}

export default App
