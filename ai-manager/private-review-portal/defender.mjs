import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export function findDefender(environment = process.env) {
  if (process.platform !== 'win32') return null
  const platformRoot = environment.ProgramData && path.join(environment.ProgramData, 'Microsoft', 'Windows Defender', 'Platform')
  if (platformRoot && fs.existsSync(platformRoot)) {
    const versions = fs.readdirSync(platformRoot).sort().reverse()
    for (const version of versions) {
      const executable = path.join(platformRoot, version, 'MpCmdRun.exe')
      if (fs.existsSync(executable)) return { executable, version }
    }
  }
  const installed = environment.ProgramFiles && path.join(environment.ProgramFiles, 'Windows Defender', 'MpCmdRun.exe')
  if (installed && fs.existsSync(installed)) return { executable: installed, version: 'installed-version-unavailable' }
  return null
}

export function scanWithDefender(file, environment = process.env) {
  const defender = findDefender(environment)
  if (!defender) return { status: 'unscanned', scanner: 'microsoft-defender', version: null, detail: 'scanner-unavailable' }
  const result = spawnSync(defender.executable, ['-Scan', '-ScanType', '3', '-File', file, '-DisableRemediation'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
    shell: false,
  })
  if (result.error) return { status: 'unscanned', scanner: 'microsoft-defender', version: defender.version, detail: result.error.code ?? 'scanner-error' }
  if (result.status === 0) return { status: 'clean', scanner: 'microsoft-defender', version: defender.version, detail: 'no-threats-detected' }
  return { status: 'rejected', scanner: 'microsoft-defender', version: defender.version, detail: `scanner-exit-${result.status}` }
}
