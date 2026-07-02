import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
  email: string
  nickname: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('dreamchord_token'),
  isLoading: true,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('dreamchord_token', token)
    } else {
      localStorage.removeItem('dreamchord_token')
    }
    set({ token })
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    localStorage.removeItem('dreamchord_token')
    set({ user: null, token: null })
  },
}))
