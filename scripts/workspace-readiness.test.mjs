import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const pretest = manifest.scripts?.pretest ?? ''
const preparation = manifest.scripts?.['prepare:workspace'] ?? ''
const testSetup = `${pretest} ${pretest.includes('prepare:workspace') ? preparation : ''}`

assert.match(testSetup, /@dreamchord\/story-domain[^&]*build/, 'pretest must build the shared story domain')
assert.match(testSetup, /dreamchord-server[^&]*prisma generate/, 'pretest must generate Prisma Client')

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(workflow, /node-version:\s*20/, 'CI must use Node.js 20')
assert.match(workflow, /version:\s*9\.1\.0/, 'CI must pin pnpm 9.1.0')
for (const command of ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test', 'pnpm build']) {
  assert.ok(workflow.includes(command), `CI must run ${command}`)
}

const launcher = readFileSync(new URL('../start-dreamchord.ps1', import.meta.url), 'utf8')
assert.doesNotMatch(launcher, /Stop-Process/, 'launcher must not terminate unrelated port owners')
assert.match(launcher, /versionNum\s+-lt\s+20/, 'launcher must require Node.js 20')
assert.match(launcher, /corepack/, 'launcher must bootstrap the pinned package manager')
assert.match(launcher, /RequiredPnpmVersion\s*=\s*'9\.1\.0'/, 'launcher must pin pnpm 9.1.0')
assert.match(launcher, /pnpmVersion\s*-eq\s*\$RequiredPnpmVersion/, 'launcher must reject other pnpm versions')
assert.match(launcher, /pnpm install --frozen-lockfile/, 'launcher must install from the workspace lockfile')
assert.match(launcher, /prisma db push --accept-data-loss/, 'launcher must synchronize legacy local databases')
assert.match(launcher, /function Find-DreamChordServer/, 'launcher must identify a running DreamChord API')
assert.match(launcher, /\.service\s+-eq\s+'dreamchord-server'/, 'launcher must verify the API service identity')
assert.match(launcher, /localhost/, 'launcher must detect a frontend bound to the IPv6 localhost interface')
const runningServerProbeIndex = launcher.indexOf('$RunningServerPort = Find-DreamChordServer')
const prismaGenerateIndex = launcher.indexOf('prisma generate')
assert.ok(runningServerProbeIndex >= 0, 'launcher must probe for a running DreamChord API')
assert.ok(
  runningServerProbeIndex < prismaGenerateIndex,
  'launcher must probe for a running DreamChord API before Prisma generation',
)
assert.match(launcher, /DreamChord 已在运行/, 'launcher must explain when it reuses a running instance')
assert.match(launcher, /SetupOnly[\s\S]*正在运行的 DreamChord/, 'setup mode must refuse to replace an active Prisma Client')
const backupIndex = launcher.indexOf('backup-local-database.ps1')
const schemaSyncIndex = launcher.indexOf('prisma db push --accept-data-loss')
assert.ok(backupIndex >= 0, 'launcher must invoke the database backup helper')
assert.ok(schemaSyncIndex >= 0, 'launcher must invoke Prisma schema synchronization')
assert.ok(
  backupIndex < schemaSyncIndex,
  'launcher must back up the local database before synchronizing it',
)
assert.doesNotMatch(launcher, /dreamchord-web dev -- --host/, 'launcher must not pass a literal -- to Vite')
assert.match(launcher, /dreamchord-web dev --host 127\.0\.0\.1/, 'launcher must bind Vite to IPv4 localhost')

const tempRoot = mkdtempSync(join(tmpdir(), 'dreamchord-readiness-'))
try {
  const envPath = join(tempRoot, '.env')
  writeFileSync(envPath, 'UPLOAD_DIR="./素材目录"\nGLM_API_KEY="keep-me"\n', 'utf8')
  const environmentScript = fileURLToPath(new URL('./ensure-environment.ps1', import.meta.url))
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    environmentScript,
    '-EnvPath',
    envPath,
    '-ServerPort',
    '3009',
    '-WebPort',
    '5182',
  ], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const configuredEnv = readFileSync(envPath, 'utf8')
  assert.match(configuredEnv, /^DATABASE_URL="file:\.\/dev\.db"$/m)
  assert.match(configuredEnv, /^JWT_SECRET="dreamchord-local-[a-f0-9]{32}"$/m)
  assert.match(configuredEnv, /^PORT=3009$/m)
  assert.match(configuredEnv, /^CORS_ORIGIN="http:\/\/127\.0\.0\.1:5182,http:\/\/localhost:5182"$/m)
  assert.match(configuredEnv, /^UPLOAD_DIR="\.\/素材目录"$/m)
  assert.match(configuredEnv, /^GLM_API_KEY="keep-me"$/m)

  const schemaDirectory = join(tempRoot, 'schema')
  const dataDirectory = join(schemaDirectory, 'custom data')
  mkdirSync(dataDirectory, { recursive: true })
  const schemaPath = join(schemaDirectory, 'schema.prisma')
  writeFileSync(schemaPath, 'schema-version-one', 'utf8')
  const databasePath = join(dataDirectory, 'writer.db')
  writeFileSync(databasePath, 'existing-dreamchord-data', 'utf8')
  const databaseEnvPath = join(tempRoot, 'database.env')
  writeFileSync(databaseEnvPath, 'DATABASE_URL="file:./custom data/writer.db"\n', 'utf8')
  const backupScript = fileURLToPath(new URL('./backup-local-database.ps1', import.meta.url))
  const runBackup = () => spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      backupScript,
      '-EnvPath',
      databaseEnvPath,
      '-SchemaPath',
      schemaPath,
    ], { encoding: 'utf8' })

  const firstBackup = runBackup()
  assert.equal(firstBackup.status, 0, firstBackup.stderr || firstBackup.stdout)
  const backupDirectory = join(dataDirectory, 'backups')
  let backups = readdirSync(backupDirectory).filter((name) => name.endsWith('.db'))
  assert.equal(backups.length, 1)
  assert.equal(readFileSync(join(backupDirectory, backups[0]), 'utf8'), 'existing-dreamchord-data')

  writeFileSync(databasePath, 'data-changed-after-schema-sync', 'utf8')
  const repeatedBackup = runBackup()
  assert.equal(repeatedBackup.status, 0, repeatedBackup.stderr || repeatedBackup.stdout)
  backups = readdirSync(backupDirectory).filter((name) => name.endsWith('.db'))
  assert.equal(backups.length, 1, 'same schema must preserve its original pre-sync snapshot')
  assert.equal(readFileSync(join(backupDirectory, backups[0]), 'utf8'), 'existing-dreamchord-data')

  writeFileSync(schemaPath, 'schema-version-two', 'utf8')
  const nextSchemaBackup = runBackup()
  assert.equal(nextSchemaBackup.status, 0, nextSchemaBackup.stderr || nextSchemaBackup.stdout)
  backups = readdirSync(backupDirectory).filter((name) => name.endsWith('.db'))
  assert.equal(backups.length, 2, 'a changed schema must create a new pre-sync snapshot')

  const emptyDatabasePath = join(dataDirectory, 'empty.db')
  writeFileSync(emptyDatabasePath, '', 'utf8')
  writeFileSync(databaseEnvPath, 'DATABASE_URL="file:./custom data/empty.db"\n', 'utf8')
  const emptyBackup = runBackup()
  assert.equal(emptyBackup.status, 0, emptyBackup.stderr || emptyBackup.stdout)
  assert.equal(readdirSync(backupDirectory).filter((name) => name.startsWith('empty-')).length, 0)

  const firstChineseDatabase = join(dataDirectory, '小说.db')
  const secondChineseDatabase = join(dataDirectory, '故事.db')
  writeFileSync(firstChineseDatabase, 'first-chinese-database', 'utf8')
  writeFileSync(secondChineseDatabase, 'second-chinese-database', 'utf8')
  writeFileSync(databaseEnvPath, 'DATABASE_URL="file:./custom data/小说.db"\n', 'utf8')
  const firstChineseBackup = runBackup()
  assert.equal(firstChineseBackup.status, 0, firstChineseBackup.stderr || firstChineseBackup.stdout)
  writeFileSync(databaseEnvPath, 'DATABASE_URL="file:./custom data/故事.db"\n', 'utf8')
  const secondChineseBackup = runBackup()
  assert.equal(secondChineseBackup.status, 0, secondChineseBackup.stderr || secondChineseBackup.stdout)
  const backupContents = readdirSync(backupDirectory)
    .filter((name) => name.endsWith('.db'))
    .map((name) => readFileSync(join(backupDirectory, name), 'utf8'))
  assert.ok(backupContents.includes('first-chinese-database'))
  assert.ok(backupContents.includes('second-chinese-database'))

  const absoluteDatabasePath = join(dataDirectory, 'absolute.db')
  writeFileSync(absoluteDatabasePath, 'absolute-file-uri-data', 'utf8')
  writeFileSync(databaseEnvPath, `DATABASE_URL="${pathToFileURL(absoluteDatabasePath).href}"\n`, 'utf8')
  const absoluteBackup = runBackup()
  assert.equal(absoluteBackup.status, 0, absoluteBackup.stderr || absoluteBackup.stdout)
  const absoluteBackups = readdirSync(backupDirectory)
    .filter((name) => name.startsWith('absolute-') && name.endsWith('.db'))
  assert.equal(absoluteBackups.length, 1)
  assert.equal(readFileSync(join(backupDirectory, absoluteBackups[0]), 'utf8'), 'absolute-file-uri-data')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

const doctor = readFileSync(new URL('./doctor.ps1', import.meta.url), 'utf8')
assert.match(doctor, /\[PASS\]/, 'doctor must emit machine-readable pass results')
assert.match(doctor, /\[FAIL\]/, 'doctor must emit machine-readable failure results')
assert.match(doctor, /DreamChord 环境诊断/, 'doctor heading must be Chinese')
assert.match(doctor, /项目文件完整/, 'doctor file checks must be Chinese')
assert.match(doctor, /检测到 DreamChord/, 'doctor must identify a running DreamChord instance in Chinese')

const batchLauncherBytes = readFileSync(new URL('../start-dreamchord.bat', import.meta.url))
const batchLauncher = batchLauncherBytes.toString('ascii')
assert.ok(
  batchLauncherBytes.every((byte) => byte < 0x80),
  'batch launcher must remain ASCII so legacy cmd.exe can parse Chinese project paths reliably',
)
assert.match(batchLauncher, /powershell\.exe[^\r\n]*-File "%~dp0start-dreamchord\.ps1"/, 'batch launcher must delegate to the colocated PowerShell script')

console.log('workspace readiness scripts are configured')
