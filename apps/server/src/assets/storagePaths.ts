import path from 'node:path'

const UPLOAD_PREFIX = '/uploads/'

export function resolveStoragePath(storageRoot: string, relativePath: string): string {
  if (!relativePath || relativePath.includes('\0')) throw new Error('素材路径不安全')
  const root = path.resolve(storageRoot)
  const resolved = path.resolve(root, relativePath)
  const relation = path.relative(root, resolved)
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('素材路径不安全')
  return resolved
}

export function storagePathFromUrl(storageRoot: string, url: string): string {
  if (!url.startsWith(UPLOAD_PREFIX)) throw new Error('素材路径不安全')
  return resolveStoragePath(storageRoot, url.slice(UPLOAD_PREFIX.length))
}

export function uploadUrl(relativePath: string): string {
  return `${UPLOAD_PREFIX}${relativePath.replaceAll('\\', '/')}`
}
