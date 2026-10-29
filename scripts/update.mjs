#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGitHubClient } from './lib/github.mjs'
import { loadAllRegistrations } from './lib/registration.mjs'
import { runUpdate } from './lib/update-runner.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(path.join(root, 'catalogue.config.json'), 'utf8'))
const token = process.env.GITHUB_TOKEN || process.env.github_api_token

if (!token) {
  console.error('[error] GITHUB_TOKEN is required')
  process.exit(1)
}

const registrations = await loadAllRegistrations(root)
const { entries, failed } = await runUpdate({
  root,
  registrations,
  github: createGitHubClient({ token }),
  maxReleases: config.update?.maxReleases ?? 20,
})

const total = registrations.plugins.length + registrations.adapters.length
if (entries.length === 0 && total > 0) {
  console.error('[error] no entry could be generated')
  process.exit(1)
}
console.log(`Generated ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}; ${failed} failure(s).`)
