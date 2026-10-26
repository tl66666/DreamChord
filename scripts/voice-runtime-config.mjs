import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const MINIFORGE_RELEASE = Object.freeze({
  tag: '26.9.4-0',
  installer: 'Miniforge3-26.9.4-0-Windows-x86_64.exe',
  checksum: 'Miniforge3-26.9.4-0-Windows-x86_64.exe.sha256',
  baseUrl: 'https://github.com/conda-forge/miniforge/releases/download/26.9.4-0',
})

export function chooseRuntimeRoot(drives, minimumGiB = 40) {
  const eligible = drives
    .filter((drive) => drive && typeof drive.root === 'string' && Number(drive.freeGiB) >= minimumGiB)
    .sort((left, right) => Number(right.freeGiB) - Number(left.freeGiB))
  if (!eligible.length) throw new Error(`声音运行时至少需要 ${minimumGiB}GB 可用空间`)
  return `${eligible[0].root.replace(/[\\/]+$/, '')}\\DreamChordRuntime`
}

export function parseSha256(text) {
  const value = String(text).trim().split(/\s+/)[0]
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('Miniforge SHA256 文件无效')
  return value.toLowerCase()
}

export function upsertEnvText(source, key, value) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error('环境变量名称无效')
  const normalized = String(source).replace(/\r\n/g, '\n')
  const line = `${key}="${String(value).replaceAll('\\', '/').replaceAll('"', '\\"')}"`
  const expression = new RegExp(`^${key}=.*$`, 'm')
  if (expression.test(normalized)) return normalized.replace(expression, line)
  return `${normalized.replace(/\s*$/, '')}\n${line}\n`
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'release-json') {
    process.stdout.write(JSON.stringify(MINIFORGE_RELEASE))
    return
  }
  if (command === 'choose-runtime') {
    process.stdout.write(chooseRuntimeRoot(JSON.parse(args[0] || '[]')))
    return
  }
  if (command === 'parse-sha') {
    process.stdout.write(parseSha256(args[0] || ''))
    return
  }
  if (command === 'upsert-env') {
    const [filePath, key, value] = args
    if (!filePath || !key || value === undefined) throw new Error('用法：upsert-env <file> <key> <value>')
    let source = ''
    try { source = await fs.readFile(filePath, 'utf8') } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await fs.writeFile(filePath, upsertEnvText(source, key, value), 'utf8')
    return
  }
  throw new Error('未知命令')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
