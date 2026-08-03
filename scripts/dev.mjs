#!/usr/bin/env node
/**
 * Dev server launcher — prevents runaway .next cache on local machines.
 * - Auto-cleans when .next exceeds MAX_CACHE_MB (default 2048)
 * - Uses Webpack by default (smaller cache than Turbopack on Windows)
 * - Pass --turbo to opt into Turbopack: npm run dev -- --turbo
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import {
  removePathRobust,
  stopLocalDevServersAndWait,
} from './fs-utils.mjs'

const root = join(import.meta.dirname, '..')
const nextDir = join(root, '.next')
const maxCacheMb = Number(process.env.SAIOS_MAX_DEV_CACHE_MB ?? 2048)
const useTurbo = process.argv.includes('--turbo')

function dirSizeBytes(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      try {
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile()) total += statSync(full).size
      } catch {
        /* skip locked files */
      }
    }
  }
  return total
}

function cleanTrashFolders() {
  for (const name of readdirSync(root)) {
    if (name.startsWith('.next.trash-')) {
      removePathRobust(join(root, name))
    }
  }
}

async function maybeCleanNext() {
  cleanTrashFolders()
  const bytes = dirSizeBytes(nextDir)
  const mb = Math.round(bytes / 1024 / 1024)
  if (bytes === 0) return

  if (mb >= maxCacheMb) {
    console.log(`.next is ${mb} MB (limit ${maxCacheMb} MB) — cleaning before dev start…`)
    await stopLocalDevServersAndWait()
    const ok = removePathRobust(nextDir)
    if (!ok) {
      console.error('Could not fully remove .next. Run: npm run dev:clean')
      process.exit(1)
    }
    return
  }

  if (useTurbo && mb >= Math.floor(maxCacheMb / 2)) {
    const turboCache = join(nextDir, 'dev', 'cache', 'turbopack')
    if (existsSync(turboCache)) {
      console.log(`.next is ${mb} MB — trimming Turbopack cache…`)
      removePathRobust(turboCache)
    }
  }
}

async function main() {
  await maybeCleanNext()

  const nextCli =
    platform() === 'win32'
      ? join(root, 'node_modules', '.bin', 'next.cmd')
      : join(root, 'node_modules', '.bin', 'next')

  const args = ['dev']
  if (!useTurbo) args.push('--webpack')

  console.log(
    useTurbo
      ? 'Starting Next.js dev (Turbopack)…'
      : 'Starting Next.js dev (Webpack — lower disk cache growth)…',
  )

  const child = spawn(nextCli, args, {
    cwd: root,
    stdio: 'inherit',
    shell: platform() === 'win32',
  })

  child.on('exit', (code) => process.exit(code ?? 0))
}

main()
