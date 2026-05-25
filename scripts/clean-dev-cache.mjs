#!/usr/bin/env node
/**
 * Removes Next.js dev/build cache. Run when Turbopack fails or disk is full.
 * On Windows, stops processes listening on ports 3000/3001 first (locked .next files).
 *
 * Usage: npm run dev:clean
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  removePathRobust,
  stopLocalDevServersAndWait,
} from './fs-utils.mjs'

const root = join(import.meta.dirname, '..')
const targets = ['.next', 'node_modules/.cache']

function removeDir(dirPath) {
  if (!existsSync(dirPath)) {
    console.log(`skip (missing): ${dirPath.replace(root + '\\', '').replace(root + '/', '')}`)
    return
  }

  const label = dirPath.replace(root + '\\', '').replace(root + '/', '')
  console.log(`removing: ${label}`)

  const ok = removePathRobust(dirPath)
  if (!ok) {
    console.error(`\nCould not remove ${label}.`)
    console.error(
      'A dev server or antivirus still has files open.\n' +
        '1. Stop ALL terminals running "npm run dev"\n' +
        '2. Close extra Cursor windows on this project\n' +
        '3. Run: npm run dev:clean again',
    )
    process.exit(1)
  }
}

async function main() {
  console.log('Stopping local dev servers on ports 3000/3001…')
  await stopLocalDevServersAndWait()

  for (const name of readdirSync(root)) {
    if (name.startsWith('.next.trash-')) {
      removeDir(join(root, name))
    }
  }

  for (const dir of targets) {
    removeDir(join(root, dir))
  }

  console.log('Dev cache cleared. Run npm run dev')
}

main()
