import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { register } from '../api/client'
import { useAuthStore } from '../stores/authStore'

function getApiError(err: unknown, fallback = '操作失败'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error || fallback
  }
  return err instanceof Error ? err.message || fallback : fallback
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const [form, setForm] = useState({
    username: '',
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const { token, user } = await register({
        username: form.username,
        email: form.email,
        password: form.password,
        nickname: form.nickname || form.username,
      })
      setToken(token)
      setUser(user)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiError(err, '注册失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-dream-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-dream-600" />
          <h1 className="text-2xl font-bold text-dream-900">注册梦弦</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              required
              className="w-full rounded-xl border border-dream-200 px-4 py-2.5 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">邮箱</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
              className="w-full rounded-xl border border-dream-200 px-4 py-2.5 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">昵称（可选）</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => handleChange('nickname', e.target.value)}
              placeholder="不填则使用用户名"
              className="w-full rounded-xl border border-dream-200 px-4 py-2.5 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">密码</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-dream-200 px-4 py-2.5 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dream-700">确认密码</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              required
              className="w-full rounded-xl border border-dream-200 px-4 py-2.5 text-sm focus:border-dream-500 focus:outline-none focus:ring-2 focus:ring-dream-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-dream-600 py-2.5 text-sm font-medium text-white transition hover:bg-dream-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '注册'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-dream-600">
          已有账号？{' '}
          <Link to="/login" className="text-dream-600 hover:underline">
            直接登录
          </Link>
        </p>
      </div>
    </div>
  )
}
