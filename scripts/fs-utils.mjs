import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Windows-safe recursive delete (handles EPERM / ENOTEMPTY / EBUSY). */
export function removePathRobust(targetPath) {
  if (!existsSync(targetPath)) return true

  if (platform() === 'win32') {
    try {
      execSync(`cmd /c rmdir /s /q "${targetPath}"`, { stdio: 'ignore' })
      if (!existsSync(targetPath)) return true
    } catch {
      /* try next method */
    }

    try {
      const escaped = targetPath.replace(/'/g, "''")
      execSync(
        `powershell -NoProfile -Command "Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction Stop"`,
        { stdio: 'ignore' },
      )
      if (!existsSync(targetPath)) return true
    } catch {
      /* try next method */
    }
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 })
      if (!existsSync(targetPath)) return true
    } catch {
      sleepSync(400)
    }
  }

  const trash = `${targetPath}.trash-${Date.now()}`
  try {
    renameSync(targetPath, trash)
    return removePathRobust(trash)
  } catch {
    return false
  }
}

export function killWindowsPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' })
        console.log(`stopped process ${pid} on port ${port}`)
      } catch {
        /* already exited */
      }
    }
  } catch {
    /* nothing listening */
  }
}

export function stopLocalDevServers() {
  if (platform() === 'win32') {
    killWindowsPort(3000)
    killWindowsPort(3001)
    return
  }
  for (const port of [3000, 3001]) {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore', shell: true })
    } catch {
      /* ignore */
    }
  }
}

export async function stopLocalDevServersAndWait(ms = 1200) {
  stopLocalDevServers()
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function removeTrashNextFolders(root) {
  let entries
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const name of entries) {
    if (name.startsWith('.next.trash-')) {
      removePathRobust(join(root, name))
    }
  }
}
