import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dreamchord_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // 清除本地认证状态，让应用跳转到登录页
      localStorage.removeItem('dreamchord_token')
      useAuthStore.getState().setUser(null)
      useAuthStore.getState().setToken(null)
    }
    return Promise.reject(error)
  },
)

export interface AuthResponse {
  token: string
  user: {
    id: string
    username: string
    email: string
    nickname: string | null
  }
}

export async function login(payload: { username: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post('/auth/login', payload)
  return data
}

export async function register(payload: {
  username: string
  email: string
  password: string
  nickname?: string
}): Promise<AuthResponse> {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export async function getMe(): Promise<AuthResponse['user']> {
  const { data } = await api.get('/auth/me')
  return data
}

export interface ProjectDetail {
  id: string
  title: string
  description: string | null
  cover: string
  isPublic: boolean
  isPublished: boolean
  author: {
    username: string
    nickname: string | null
  }
  chapters: Chapter[]
  characters: Character[]
}

export interface Chapter {
  id: string
  title: string
  order: number
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowNode {
  id: string
  nodeId: string
  type: string
  positionX: number
  positionY: number
  data: string
}

export interface FlowEdge {
  id: string
  edgeId: string
  source: string
  target: string
  label: string | null
  sourceHandle: string | null
  animated: boolean
}

export interface Character {
  id: string
  name: string
  description: string | null
  color: string
  defaultSprite: string
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const { data } = await api.get(`/projects/${id}`)
  return data
}

export async function getMyProjects(): Promise<ProjectDetail[]> {
  const { data } = await api.get('/projects/me/list')
  return data
}

export async function getPublicProjects(): Promise<ProjectDetail[]> {
  const { data } = await api.get('/projects')
  return data
}

export async function createProject(payload: {
  title?: string
  description?: string
}): Promise<ProjectDetail> {
  const { data } = await api.post('/projects', payload)
  return data
}

export async function updateProject(
  id: string,
  payload: Partial<{
    title: string
    description: string
    cover: string
    isPublic: boolean
    isPublished: boolean
  }>,
): Promise<ProjectDetail> {
  const { data } = await api.patch(`/projects/${id}`, payload)
  return data
}

export async function createChapter(projectId: string, payload: { title?: string }): Promise<Chapter> {
  const { data } = await api.post(`/projects/${projectId}/chapters`, payload)
  return data
}

export async function updateChapter(projectId: string, chapterId: string, payload: { title?: string }): Promise<Chapter> {
  const { data } = await api.patch(`/projects/${projectId}/chapters/${chapterId}`, payload)
  return data
}

export async function deleteChapter(projectId: string, chapterId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/chapters/${chapterId}`)
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}

export interface Asset {
  id: string
  name: string
  type: string
  url: string
  createdAt: string
}

export async function getProjectAssets(projectId: string): Promise<Asset[]> {
  const { data } = await api.get(`/assets/${projectId}`)
  return data
}

export async function deleteAsset(assetId: string): Promise<void> {
  await api.delete(`/assets/${assetId}`)
}

export async function renameAsset(assetId: string, name: string): Promise<Asset> {
  const { data } = await api.patch(`/assets/${assetId}`, { name })
  return data
}

export async function uploadAsset(
  projectId: string,
  file: File,
  type: string,
): Promise<Asset> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', projectId)
  formData.append('type', type)
  formData.append('name', file.name)

  const { data } = await api.post('/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function replaceAssetFile(
  assetId: string,
  file: File,
  payload?: { name?: string; type?: string },
): Promise<Asset> {
  const formData = new FormData()
  formData.append('file', file)
  if (payload?.name) formData.append('name', payload.name)
  if (payload?.type) formData.append('type', payload.type)

  const { data } = await api.put(`/assets/${assetId}/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export interface SaveChapterPayload {
  chapterId: string
  nodes: {
    nodeId: string
    type: string
    positionX: number
    positionY: number
    data: string
  }[]
  edges: {
    edgeId: string
    source: string
    target: string
    label?: string
    sourceHandle?: string
    animated: boolean
  }[]
}

export async function saveChapter(projectId: string, payload: SaveChapterPayload): Promise<void> {
  await api.put(`/projects/${projectId}/chapters/${payload.chapterId}`, payload)
}

export async function polishText(payload: {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  text: string
  style?: string
}): Promise<{ content: string }> {
  const { data } = await api.post('/ai/polish', payload)
  return data
}

export async function continueStory(payload: {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  context: string
}): Promise<{ content: string }> {
  const { data } = await api.post('/ai/continue', payload)
  return data
}

export async function generateChoices(payload: {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  context: string
  count?: number
}): Promise<{ content: string }> {
  const { data } = await api.post('/ai/choices', payload)
  return data
}

export async function chatWithAI(payload: {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  temperature?: number
}): Promise<{ content: string }> {
  const { data } = await api.post('/ai/chat', payload)
  return data
}

export interface GeneratedNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface GeneratedEdge {
  id: string
  source: string
  target: string
  animated?: boolean
  label?: string
  sourceHandle?: string
}

export async function generateStory(payload: {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  prompt: string
  context?: string
  temperature?: number
}): Promise<{ nodes: GeneratedNode[]; edges: GeneratedEdge[] }> {
  const { data } = await api.post('/ai/generate-story', payload)
  return data
}
