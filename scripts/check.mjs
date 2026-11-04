#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkRegistrations } from './lib/check.mjs'
import { createGitHubClient } from './lib/github.mjs'
import { loadAllRegistrations } from './lib/registration.mjs'
import { loadRegistrationValidator } from './lib/schema.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const offline = args.has('--offline')
const skipRelease = offline || args.has('--skip-release')

const config = JSON.parse(await readFile(path.join(root, 'catalogue.config.json'), 'utf8'))
const validators = {
  plugin: await loadRegistrationValidator(path.join(root, 'schemas/plugin_info.schema.json')),
  adapter: await loadRegistrationValidator(path.join(root, 'schemas/adapter_info.schema.json')),
}

let registrations
let loadErrors
try {
  const loaded = await loadAllRegistrations(root, { tolerant: true })
  registrations = [...loaded.plugins, ...loaded.adapters]
  loadErrors = loaded.errors
} catch (error) {
  console.error(`[error] ${error.message}`)
  process.exit(1)
}

const token = process.env.GITHUB_TOKEN || process.env.github_api_token
const github = !offline && token ? createGitHubClient({ token }) : null
if (!offline && !token) {
  console.warn('[warn] GITHUB_TOKEN is not set; remote checks are skipped')
}

const result = await checkRegistrations({
  registrations,
  loadErrors,
  validators,
  github,
  skipRelease,
  maxReleases: config.update?.maxReleases ?? 20,
})

console.log(`Checked ${result.checked} registration(s); ${result.failed} failed.`)
